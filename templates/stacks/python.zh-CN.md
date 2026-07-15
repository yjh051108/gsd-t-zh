# Python 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 类型标注

```
强制:
  ├── 所有函数签名都有类型标注（参数 + 返回值）
  ├── 使用内置泛型（list, dict, tuple）— 不用 typing.List 等（Python 3.9+）
  ├── 联合类型用 | — 不用 typing.Union（Python 3.10+）
  ├── 结构化数据使用 dataclasses 或 Pydantic 模型 — 绝不使用原始 dict
  └── CI 中运行 mypy 或 pyright — 无未标注的公共函数
```

**坏**
```python
def get_users(filters):
    result = {"users": [], "total": 0}
    return result
```

**好**
```python
@dataclass
class UserList:
    users: list[User]
    total: int

def get_users(filters: UserFilters) -> UserList:
    ...
```

---

## 2. 项目结构

```
强制:
  ├── 包使用 src/ 布局: src/{package_name}/
  ├── 测试镜像源码: tests/{module}/test_{file}.py
  ├── 主要类一个文件一个类 — 小工具可共享
  ├── __init__.py 只导出公共 API
  └── 配置来自环境变量或 .env — 绝不硬编码
```

---

## 3. 数据模型

```
强制:
  ├── 内部数据结构使用 dataclasses
  ├── API 输入/输出和验证使用 Pydantic BaseModel
  ├── 固定选项集使用 Enums — 不使用隐式允许值的 magic string
  ├── 不可变值对象使用 frozen dataclass
  └── 绝不传原始 dict 给函数或作为返回值 — 定义一个模型
```

**坏** — `def create_user(data: dict) -> dict:`

**好**
```python
class CreateUserRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    role: UserRole  # Enum

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime

def create_user(request: CreateUserRequest) -> UserResponse:
    ...
```

---

## 4. 错误处理

```
强制:
  ├── 按领域定义自定义异常层次 — 绝不 raise 裸 Exception
  ├── 捕获特定异常 — 绝不用裸 except: 或 except Exception:
  ├── 在边界（API 处理器、CLI 入口）用 try/except — 不在业务逻辑深层
  ├── 重新 raise 前用上下文记录异常（structlog 或 logging）
  └── 返回错误类型或 raise — 绝不返回 None 表示失败
```

**坏**
```python
try:
    result = do_something()
except:
    return None
```

**好**
```python
class UserNotFoundError(DomainError):
    def __init__(self, user_id: str):
        super().__init__(f"User {user_id} not found")
        self.user_id = user_id

try:
    user = user_repo.get(user_id)
except UserNotFoundError:
    logger.warning("user_not_found", user_id=user_id)
    raise
```

---

## 5. 函数和方法

```
强制:
  ├── 函数最多 30 行 — 超过就拆分
  ├── 文件最多 200 行 — 需要时创建新模块
  ├── 单一职责 — 一个函数只做一件事
  ├── 3+ 参数的函数使用关键字参数
  ├── 默认可变参数禁止 — 用 None + 工厂模式
  └── 公共函数写 docstring — 明显的方法可省略
```

**坏** — `def register(name, email, role, send_email=True, template=[], notify=[]):`

**好**
```python
def register(
    *,
    name: str,
    email: str,
    role: UserRole,
    send_email: bool = True,
    template: list[str] | None = None,
    notify: list[str] | None = None,
) -> User:
    template = template or []
    notify = notify or []
    ...
```

---

## 6. 异步模式

```
使用异步时:
  ├── I/O 密集型操作（HTTP, DB, 文件）用 async def — CPU 密集型不用
  ├── 并发 I/O 用 asyncio.gather — 不用顺序 await
  ├── 绝不混合同步和异步 — 同步库用 run_in_executor
  ├── 外部调用始终设置超时（httpx, aiohttp）
  └── 连接和会话用 async context managers
```

**坏** — 独立调用的顺序 await:
```python
users = await get_users()
orders = await get_orders()  # 等 users 完成才开始
```

**好**
```python
users, orders = await asyncio.gather(get_users(), get_orders())
```

---

## 7. 测试

```
强制:
  ├── pytest 作为测试运行器 — 不用 unittest
  ├── 用 fixtures 做 setup/teardown — 不用 setUp/tearDown 方法
  ├── 多输入测试用 parametrize
  ├── 测试文件命名: test_{module}.py
  ├── 测试函数命名: test_{行为}_when_{条件}
  └── 用 plain assert — 不用 self.assertEqual
```

**好**
```python
@pytest.fixture
def user_service(db_session: Session) -> UserService:
    return UserService(db_session)

@pytest.mark.parametrize("role,expected", [
    (UserRole.ADMIN, True),
    (UserRole.VIEWER, False),
])
def test_can_delete_when_role(user_service: UserService, role: UserRole, expected: bool):
    assert user_service.can_delete(role) == expected
```

---

## 8. 依赖与导入

```
强制:
  ├── 使用虚拟环境（venv, poetry, uv）— 绝不全局安装
  ├── 依赖在 requirements.txt 或 pyproject.toml 中固定版本
  ├── 导入顺序: stdlib → third-party → local（isort/ruff 强制）
  ├── 跨模块用绝对导入 — 同包内用相对导入
  └── 绝不 import * — 仅显式导入
```

---

## 9. 反模式

```
绝不要:
  ├── 裸 except: 或 except Exception: 不重新 raise
  ├── 可变默认参数（def f(items=[])）
  ├── 全局可变状态 — 使用依赖注入
  ├── SQL 字符串拼接 — 使用参数化查询
  ├── print() 做日志 — 使用 logging/structlog
  ├── 原始 dict 作为函数参数或返回值
  ├── 嵌套函数超过 2 层
  └── type: ignore 不加解释注释
```

---

## Python 验证清单

- [ ] 所有函数签名有类型标注
- [ ] 结构化数据用 Pydantic 或 dataclass — 无原始 dict
- [ ] 自定义异常 — 无裸 Exception raise
- [ ] 函数最多 30 行，文件最多 200 行
- [ ] 无可变默认参数
- [ ] pytest with fixtures — 无 unittest 模式
- [ ] 导入顺序强制（stdlib → third-party → local）
- [ ] 提交代码中没有 print() — 使用 logging
- [ ] 虚拟环境 + 固定版本依赖
- [ ] 无字符串拼接 SQL — 仅参数化查询
