# 基础设施 — {Project Name}

## 最后更新: {Date}

## 快速参考

| 任务 | 命令 |
|------|---------|
| 启动开发服务器 | `{command}` |
| 运行测试 | `{command}` |
| 执行迁移 | `{command}` |
| 部署 | `{command}` |

## 本地开发

### 环境搭建
```bash
# 克隆并安装
git clone {repo}
cd {project}
{install commands}

# 环境变量
cp .env.example .env
# 填写必填值 (见凭据章节)

# 数据库
{db setup commands}

# 启动
{start command}
```

### 本地地址
- App: http://localhost:{port}
- API 文档: http://localhost:{port}/docs
- 数据库: localhost:{port}

## 数据库

### 迁移
```bash
# 创建迁移
{command}

# 应用迁移
{command}

# 回滚
{command}
```

### 直接访问
```bash
# 本地
{command}

# 生产环境
{command}
```

### 备份与恢复
```bash
# 备份
{command}

# 恢复
{command}
```

## 凭据与密钥

### 本地 (.env)
| 变量 | 用途 | 获取方式 |
|----------|---------|-----------------|
| DATABASE_URL | 数据库连接 | 本地配置 |
| SECRET_KEY | JWT 签名 | 使用 `{command}` 生成 |

### 生产环境
| 密钥 | 位置 | 访问方式 |
|--------|----------|---------------|
| {name} | {e.g., GCP Secret Manager} | `{command}` |

## 部署

### 生产环境
```bash
# 构建
{command}

# 部署
{command}

# 验证
{command}
```

### CI/CD
- **流水线**: {例如: GitHub Actions}
- **触发条件**: {例如: 推送到 main}
- **步骤**: {build → test → deploy}

## 日志与监控

### 查看日志
```bash
# 生产日志
{command}

# 实时日志
{command}
```

### 监控
- **仪表板**: {url}
- **告警**: {configuration}
