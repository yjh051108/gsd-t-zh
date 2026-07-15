# Node.js API 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 服务层模式

HTTP 知识只属于服务。控制器是薄委托者。

```
强制:
  ├── 控制器: 验证输入、调用服务、返回响应 — 仅此而已
  ├── 服务: 所有业务逻辑、数据访问、外部 HTTP 调用
  └── 绝不在控制器、hooks 或 UI 组件中导入 axios/fetch
```

**坏:** `router.get('/users/:id', async (req, res) => { const r = await axios.get(...); res.json(r.data); })`

**好:**
```js
// controller — 仅委托
router.get('/users/:id', async (req, res, next) => {
  try { res.json({ data: await userService.getById(req.params.id) }); }
  catch (err) { next(err); }
});
```

---

## 2. 请求验证

每个端点必须验证输入。拒绝意外字段。

```
强制:
  ├── 用 Zod 或 Joi schema 验证 bodies、路径参数和查询字符串
  ├── 使用 .strict()（Zod）或 .unknown(false)（Joi）— 拒绝额外字段
  └── 在业务逻辑运行前返回 400 和结构化错误
```

**坏:** `await orderService.create(req.body)` — 原始未验证的输入

**好:**
```js
const schema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) }).strict();
router.post('/orders', validate(schema), async (req, res, next) => { ... });
```

---

## 3. 响应格式化

所有端点返回一致的形状。

```
成功: { data: T, meta?: { page, total } }
错误:   { error: { code: string, message: string } }
绝不在顶层返回原始对象、数组或字符串。
```

---

## 4. 错误处理

```
强制:
  ├── 注册全局错误处理器中间件作为最后一个 app.use()
  ├── 所有路由处理器在捕获的错误上调用 next(err) — 不吞掉
  ├── 没有空的 catch 块 — 至少记录日志，然后重新抛出或 next(err)
  ├── 服务端记录完整错误；向客户端返回清理后的响应
  └── 绝不在生产响应中包含堆栈跟踪
```

**全局错误处理器:**
```js
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path });
  const status = err.statusCode ?? 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error' : err.message;
  res.status(status).json({ error: { code: err.code ?? 'ERR_INTERNAL', message } });
});
```

---

## 5. 中间件顺序

按此确切顺序注册:

```
1. 安全头部 (helmet)
2. CORS — 见 _security.md
3. Body parser（带大小限制的 express.json）
4. 请求/关联 ID
5. Auth 中间件 — 见 _security.md
6. 速率限制 — 见 _security.md
7. 路由级验证
8. 路由处理器
9. 404 处理器
10. 全局错误处理器（最后）
```

---

## 6. 环境配置

```
强制:
  ├── 所有配置来自环境变量 — 没有硬编码值
  ├── 绝不提交包含真实值的 .env 文件
  ├── 客户端变量: 仅 VITE_ 或 NEXT_PUBLIC_ 前缀
  ├── 绝不在客户端包中暴露服务器密钥（DB_PASSWORD, API_KEY）
  └── 启动时验证必需环境变量 — 缺失时快速失败
```

**坏:** `new Pool({ password: 'hardcoded123' })`

**好:**
```js
['DATABASE_URL', 'JWT_SECRET'].forEach(k => {
  if (!process.env[k]) throw new Error(`Missing env: ${k}`);
});
```

---

## 7. 结构化日志

```
强制:
  ├── 使用结构化 JSON 日志（pino 或带 json transport 的 winston）
  ├── 绝不在日志中记录 PII — 在记录前脱敏 email、name、phone、令牌
  ├── 在每行日志中包含请求 ID 以便追踪
  └── 生产路径中没有 console.log
```

**坏:** `console.log('User:', user)` — 泄露 PII

**好:** `logger.info({ userId: user.id, action: 'login' }, 'User authenticated')`

---

## 8. 健康检查端点

```js
app.get('/health', (req, res) =>
  res.json({ status: 'ok', uptime: process.uptime() }));
// /health/ready — 也检查 DB/依赖可达性
```

---

## 9. 优雅关闭

```
强制:
  ├── 处理 SIGTERM 和 SIGINT
  ├── 立即停止接受新连接
  ├── 排空进行中的请求（10 秒超时）
  └── 退出前关闭 DB 连接池
```

```js
const shutdown = async () => {
  server.close(async () => { await db.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## 10. 安全交叉引用

以下主题在 `_security.md` 中涵盖 — 不要在此重复：
SQL 注入、auth token 存储、CORS、Content Security Policy、速率限制、输入清理。

---

## 验证清单

- [ ] 路由处理器将所有逻辑委托给服务 — 控制器中没有业务逻辑
- [ ] 每个端点都有带 strict 模式的 Zod/Joi schema（不允许额外字段）
- [ ] 所有响应使用 `{ data }` 或 `{ error: { code, message } }` 形状
- [ ] 全局错误处理器注册在最后 — 没有路由通过 `res.json` 直接处理错误
- [ ] 生产响应中没有堆栈跟踪
- [ ] 没有静默 catch 块 — 所有错误都被记录或重新抛出
- [ ] 所有配置来自环境变量 — 没有硬编码密钥或连接字符串
- [ ] 使用结构化 JSON 日志 — 生产路径中没有 `console.log`
- [ ] 日志输出中没有 PII
- [ ] `/health` 端点返回 200 和状态 payload
- [ ] 注册了带连接排空的 SIGTERM/SIGINT 处理器
- [ ] 安全问题（SQL 注入、CORS、令牌）委托给 `_security.md`
