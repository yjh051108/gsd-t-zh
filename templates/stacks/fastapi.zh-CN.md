# FastAPI 标准（检测到 FastAPI 时适用）

这些规则是 **强制** 的。违规导致任务失败。没有例外。
适用于 `requirements.txt` 或 `pyproject.toml` 中包含 `fastapi` 的项目。

---

## 1. 应用结构

```
强制:
  ├── 使用工厂模式: create_app() 函数返回 FastAPI 实例
  ├── 通过 app.include_router() 注册路由器 — 不是内联路由定义
  ├── 使用 lifespan 上下文管理器进行启动/关闭（非 @app.on_event — 已弃用）
  ├── 按域分组路由到路由器: routers/users.py, routers/orders.py
  ├── 每个文件一个路由器 — 绝不用一个 routes.py 包含所有内容
  └── 入口点: main.py 或 app.py 调用 create_app() — uvicorn 指向这里
```

**好**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动: 初始化 DB 连接池、缓存等
    await db.connect()
    yield
    # 关闭: 清理
    await db.disconnect()

def create_app() -> FastAPI:
    app = FastAPI(title="MyAPI", lifespan=lifespan)
    app.include_router(users_router, prefix="/users", tags=["users"])
    app.include_router(orders_router, prefix="/orders", tags=["orders"])
    return app
```

**坏** — 已弃用的 on_event:
```python
@app.on_event("startup")  # 已弃用 — 使用 lifespan 替代
async def startup():
    await db.connect()
```

---

## 2. 依赖注入

```
强制:
  ├── 对所有共享逻辑使用 Depends(): 认证、DB 会话、配置、分页
  ├── 依赖返回值 — 绝不将修改请求状态作为副作用
  ├── 链式依赖: get_current_user 依赖 get_token 依赖 get_header
  ├── 对资源清理使用 yield 依赖（DB 会话、文件句柄）
  ├── 对依赖返回值进行类型提示 — FastAPI 用它来生成 OpenAPI 文档
  └── 绝不在路由处理器中直接导入和调用服务 — 注入它们
```

**好**
```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await authenticate(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

@router.get("/me")
async def read_current_user(user: User = Depends(get_current_user)):
    return user
```

**坏** — 没有 DI，直接导入:
```python
@router.get("/me")
async def read_current_user(request: Request):
    db = get_database_connection()  # 手动 — 不可注入、不可测试
    token = request.headers.get("Authorization")
    user = authenticate(token, db)
```

---

## 3. 请求/响应模型（Pydantic）

```
强制:
  ├── 每个端点都有显式的请求 **和** 响应模型 — 不用原始 dict
  ├── 使用独立模型: UserCreate（输入）、UserResponse（输出）、UserInDB（内部）
  ├── 响应模型绝不过渡暴露内部字段（hashed_password、内部 ID）
  ├── 在路由装饰器上使用 response_model 参数 — 不手动构建 dict
  ├── 用 Field() 验证: 最小/最大长度、正则、数字的 ge/le
  ├── 对 ORM 兼容性使用 model_config with from_attributes=True（Pydantic v2）
  └── 绝不用 dict() 或 **kwargs 构建响应 — 使用响应模型
```

**好**
```python
from pydantic import BaseModel, Field, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    model_config = {"from_attributes": True}

@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    user = await user_service.create(db, body)
    return user  # Pydantic 通过 response_model 自动过滤字段
```

---

## 4. 错误处理

```
强制:
  ├── 对预期错误使用 HTTPException（404, 409, 422）
  ├── 为域错误创建自定义异常类 — 在处理器中映射到 HTTP
  ├── 为自定义异常注册 exception_handler() — 不在各处 catch-and-reraise
  ├── 返回一致错误形状: { "detail": "message" } 或 { "detail": [{ "loc": [...], "msg": "..." }] }
  ├── 绝不返回 500 表示可恢复错误 — 映射到适当的 4xx
  ├── 绝不在生产中暴露堆栈跟踪 — 配置异常处理器
  └── 让 FastAPI 内置的 RequestValidationError 处理 422 — 除非添加上下文否则不覆盖
```

**好**
```python
class NotFoundError(Exception):
    def __init__(self, resource: str, id: Any):
        self.resource = resource
        self.id = id

@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": f"{exc.resource} {exc.id} not found"},
    )
```

---

## 5. 异步模式

```
强制:
  ├── 对所有路由处理器使用 async def — 即使它们不 await 任何东西
  ├── 使用异步 DB 驱动: asyncpg（PostgreSQL）、aiosqlite、motor（MongoDB）
  ├── 绝不在异步处理器中调用同步阻塞函数
  │     ├── 阻塞 I/O（文件读取、子进程）→ 使用 run_in_executor 或 anyio.to_thread
  │     └── CPU 密集型工作 → 使用 BackgroundTasks 或任务队列
  ├── 对并发独立操作使用 asyncio.gather()
  ├── 绝不用 time.sleep() — 使用 asyncio.sleep()
  └── 连接池: 为异步引擎配置 pool_size 和 max_overflow
```

**好** — 并发操作:
```python
@router.get("/dashboard")
async def get_dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stats, notifications, recent = await asyncio.gather(
        get_user_stats(db, user.id),
        get_notifications(db, user.id),
        get_recent_activity(db, user.id),
    )
    return {"stats": stats, "notifications": notifications, "recent": recent}
```

---

## 6. 后台任务

```
强制:
  ├── 对 fire-and-forget 工作使用 BackgroundTasks（邮件、日志、清理）
  ├── 后台任务在响应发送 **之后** 运行 — 不要用于客户端需要的东西
  ├── 对于长时间运行或关键工作 → 使用适当的任务队列（Celery, ARQ, dramatiq）
  ├── 后台任务共享同一个进程 — 不要阻塞事件循环
  └── 绝不用 BackgroundTasks 处理必须可靠完成的事情（支付、数据同步）
```

**好**
```python
@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user = await user_service.create(db, body)
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

---

## 7. 中间件

```
强制:
  ├── 对跨领域关注点使用 @app.middleware("http")（计时、请求 ID、CORS）
  ├── 添加 CORSMiddleware 并显式设置 allow_origins — 绝不在生产中使用 allow_origins=["*"]
  ├── 添加请求 ID 中间件: 每个请求生成 UUID，包含在响应头和日志中
  ├── 顺序很重要: 中间件在请求上从上到下运行，在响应上从下到上运行
  ├── 绝不在中间件中进行繁重计算 — 它在每个请求上运行
  └── 对可观察性使用中间件（计时、日志），而非业务逻辑
```

**好**
```python
import uuid

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # 来自环境变量的显式列表
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 8. 配置

```
强制:
  ├── 对所有配置使用 pydantic-settings（BaseSettings）
  ├── 从环境变量加载 — 绝不在代码中硬编码密钥或 URL
  ├── 使用 .env 文件仅用于本地开发 — 绝不提交 .env 文件
  ├── 在启动时类型验证所有配置 — 缺失/无效值时快速失败
  ├── 在 get_settings() 上使用 @lru_cache 以避免每次请求重新解析
  └── 分组设置: DatabaseSettings, AuthSettings, AppSettings
```

**好**
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    cors_origins: list[str] = ["http://localhost:3000"]
    debug: bool = False

    model_config = {"env_file": ".env"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## 9. 测试

```
强制:
  ├── 对异步测试使用 httpx.AsyncClient 与 ASGITransport — 不用 TestClient
  ├── 在测试中覆盖依赖: app.dependency_overrides[get_db] = mock_db
  ├── 对异步测试函数使用 pytest-asyncio
  ├── 每个测试获得新的数据库事务 — 每个测试后回滚
  ├── 测试响应状态码 **和** 响应体形状
  ├── 测试验证: 发送无效输入，验证 422 与正确的错误消息
  └── 绝不对共享/生产数据库进行测试
```

**好**
```python
import pytest
from httpx import ASGITransport, AsyncClient

@pytest.fixture
async def client(test_db):
    app.dependency_overrides[get_db] = lambda: test_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post("/users", json={"email": "test@example.com", "name": "Test"})
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "hashed_password" not in data  # 绝不过度暴露
```

---

## 10. OpenAPI / Swagger

```
强制:
  ├── FastAPI 自动生成 OpenAPI — 利用它，不要对抗它
  ├── 通过 docstrings 或参数为每个路由添加 summary 和 description
  ├── 使用 tags 在 Swagger UI 中分组端点
  ├── 对成功使用 response_model，对错误形状使用 responses={}
  ├── 在 /docs（Swagger UI）和 /redoc（ReDoc）提供文档 — 按需在生产中禁用
  └── 绝不手动编写 OpenAPI YAML — 让 FastAPI 从代码生成
```

**好**
```python
@router.post(
    "/users",
    response_model=UserResponse,
    status_code=201,
    summary="创建新用户",
    responses={
        409: {"description": "邮箱已注册"},
        422: {"description": "验证错误"},
    },
)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """创建用户账户。创建后发送欢迎邮件。"""
    ...
```

---

## 11. 反模式

```
绝不要:
  ├── @app.on_event("startup"/"shutdown") — 使用 lifespan 上下文管理器
  ├── 异步处理器中使用同步 DB 驱动（psycopg2, sqlite3）— 使用异步驱动
  ├── 没有 response_model 的原始 dict 返回 — 无类型安全，无字段过滤
  ├── 路由处理器中的业务逻辑 — 提取到服务层
  ├── 全局可变状态（模块级 dicts/lists）— 使用依赖注入
  ├── 在处理器中广泛捕获 Exception — 让 FastAPI 的错误处理工作
  ├── 异步代码中的 time.sleep() — 阻塞事件循环
  ├── 异步测试使用 TestClient — 使用 httpx.AsyncClient with ASGITransport
  └── 生产 CORS 配置中使用 allow_origins=["*"]
```

---

## FastAPI 验证清单

- [ ] 使用带 lifespan 上下文管理器的工厂模式（非 on_event）
- [ ] 所有共享逻辑通过 Depends() 注入
- [ ] 输入、输出、内部使用分离的 Pydantic 模型
- [ ] 响应模型中不暴露内部字段
- [ ] 带注册处理器的自定义异常
- [ ] 所有处理器是 async def 且使用异步 I/O
- [ ] 对 fire-and-forget 使用 BackgroundTasks，对关键工作使用任务队列
- [ ] 通过 pydantic-settings 和 env vars 配置
- [ ] 测试使用 httpx.AsyncClient，不是 TestClient
- [ ] OpenAPI 文档自动生成，带摘要和错误响应
- [ ] CORS 配置了显式来源
