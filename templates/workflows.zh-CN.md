# 工作流 — {Project Name}

## 最后更新: {Date}

## 用户工作流

### {工作流名称} (例如: 用户注册)
1. {步骤 1}
2. {步骤 2}
3. {步骤 3}

**入口**: {文件/路由}
**成功**: {结果}
**失败**: {错误处理}

## 技术工作流

### {工作流名称} (例如: 数据库迁移)
1. {步骤 1}
2. {步骤 2}

**触发条件**: {手动 / 定时 / 事件}
**频率**: {一次性 / 每日 / 按需}

## API 工作流

### {多步骤 API 流程}
```
Client → POST /api/auth/login
  → Server validates credentials
  → Server generates JWT
  → Client receives token
  → Client stores token
  → Client redirects to dashboard
```

## 集成工作流

### {外部系统同步}
- **触发**: {启动条件}
- **流程**: {逐步描述}
- **错误处理**: {重试策略，降级}
- **监控**: {如何检查状态}
