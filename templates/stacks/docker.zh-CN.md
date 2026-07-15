# Docker 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. Dockerfile — 多阶段构建

```
强制:
  ├── 使用多阶段构建 — 分离构建和运行时阶段
  ├── 最终阶段使用最小基础镜像（alpine、distroless、slim）
  ├── 绝不在运行时阶段安装开发依赖
  ├── 固定基础镜像版本 — 绝不用 :latest
  └── 一个容器一个服务 — 不是多个进程
```

**坏**
```dockerfile
FROM node:20
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

**好**
```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# 运行时阶段
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## 2. 层优化

```
强制:
  ├── 在源代码 **之前** 复制 package.json/lock 文件 — 利用层缓存
  ├── 使用 .dockerignore 排除 node_modules、.git、.env、构建产物
  ├── 在逻辑上合并 RUN 命令 — 每个 RUN 创建一个层
  ├── 在同一 RUN 中清理缓存（创建缓存的 RUN）
  └── 指令从最少变更到最多变更排序
```

**好** `.dockerignore`:
```
node_modules
.git
.env*
dist
*.md
.gsd-t
```

---

## 3. 安全

```
强制:
  ├── 以非 root 用户运行（USER node, USER nobody，或创建专用用户）
  ├── 绝不将 .env 文件复制到镜像中 — 使用运行时环境变量或密钥
  ├── 绝不在 Dockerfile 中硬编码密钥、令牌或密码
  ├── 优先使用 COPY 而非 ADD（ADD 可以自动解压归档和获取 URL — 太隐式）
  ├── 扫描镜像漏洞（docker scout, trivy, snyk）
  └── 为生产镜像设置 HEALTHCHECK 指令
```

---

## 4. Docker Compose

```
强制:
  ├── 使用 compose.yaml（不是 docker-compose.yml — 现代命名）
  ├── 尽可能始终指定 depends_on 与 condition: service_healthy
  ├── 对持久化数据使用命名卷 — 绝不在生产中绑定挂载数据目录
  ├── 显式定义网络 — 不要依赖默认网桥
  ├── 通过 env_file 使用环境变量 — 不在 compose.yaml 内联
  └── 在 compose 中固定镜像版本 — 不用 :latest
```

**好**
```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

volumes:
  pgdata:

networks:
  app-network:
```

---

## 5. 镜像标签

```
强制:
  ├── 用语义版本标签: myapp:1.2.3
  ├── 也用 git SHA 标签以追踪: myapp:abc1234
  ├── 只在 main/production 分支上标签 :latest
  ├── 绝不向注册表推送无标签镜像
  └── 使用一致的命名: {registry}/{org}/{app}:{tag}
```

---

## 6. 开发 vs 生产

```
强制:
  ├── 对开发特定配置使用 compose.override.yaml（热重载、调试端口）
  ├── 开发: 绑定挂载源代码以热重载
  ├── 生产: COPY 构建产物 — 无绑定挂载
  ├── 开发: 包含开发依赖和调试工具
  ├── 生产: 仅生产依赖，无 source maps
  └── 绝不在生产中使用开发镜像
```

---

## 7. 健康检查

```
生产强制:
  ├── 独立容器的 Dockerfile 中 HEALTHCHECK
  ├── 编排服务在 compose 中 healthcheck
  ├── 检查实际就绪状态（HTTP 端点、DB 连接）— 不只是进程存活
  ├── 合理的间隔: 10-30 秒间隔，3-5 次重试
  └── 轻量级检查 — 不要命中昂贵的端点
```

---

## 8. 反模式

```
绝不要:
  ├── 生产中使用 :latest — 固定版本
  ├── 容器中使用 root 用户 — 始终 USER 非 root
  ├── 密钥在构建参数或 ENV 中 — 使用运行时密钥
  ├── 当 COPY 足够时使用 ADD
  ├── 一个容器中多个服务 — 一个容器一个进程
  ├── 忽略 .dockerignore — 膨胀镜像和泄露文件
  ├── 在同一个 RUN 中执行 apt-get install 后不清理
  └── 在生产 compose 中绑定挂载主机路径
```

---

## Docker 验证清单

- [ ] 多阶段构建，最小运行时镜像
- [ ] 基础镜像固定到特定版本
- [ ] .dockerignore 排除 node_modules、.git、.env
- [ ] 以非 root 用户运行
- [ ] Dockerfile 或构建参数中没有密钥
- [ ] 层缓存优化（先复制包文件，后复制源代码）
- [ ] 定义了 HEALTHCHECK
- [ ] Compose 使用命名卷和显式网络
- [ ] 镜像用版本和 git SHA 标签
- [ ] 开发和生产配置分离
