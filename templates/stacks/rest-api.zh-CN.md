# REST API 设计标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. URL 设计

```
强制:
  ├── 用名词，不用动词: /users, /orders — 绝不 /getUsers, /createOrder
  ├── 集合用复数: /users, /products, /orders
  ├── 关联关系用嵌套资源: /users/{id}/orders
  ├── 嵌套最多 2 层 — 更深则扁平化
  ├── 多词路径用 kebab-case: /order-items — 非 /orderItems 或 /order_items
  ├── API 版本在 URL 路径中: /api/v1/users — 不在 header 中
  └── 绝不暴露内部 ID 或数据库结构在 URL 中
```

**坏** — `/api/getUserById?id=123`, `/api/v1/order_items`

**好** — `/api/v1/users/123`, `/api/v1/order-items`

---

## 2. HTTP 方法

```
强制:
  ├── GET: 读取（无副作用，可缓存）
  ├── POST: 创建新资源（返回 201 + Location header）
  ├── PUT: 完全替换资源
  ├── PATCH: 部分更新资源
  ├── DELETE: 删除资源（返回 204 或 200）
  ├── GET 绝不能修改数据
  └── POST 不是万能 — 用正确的方法
```

---

## 3. 响应格式

```
强制 — 所有响应一致 envelope:
  ├── 成功: { "data": {...} } 或 { "data": [...] }
  ├── 集合: { "data": [...], "meta": { "total": N, "page": 1, "pageSize": 20 } }
  ├── 错误: { "error": { "code": "NOT_FOUND", "message": "User not found" } }
  ├── JSON key 用 camelCase — 符合 JavaScript 约定
  ├── 时间戳用带时区的 ISO 8601 字符串（2026-03-25T10:00:00Z）
  └── 空字段: 包含 null 值 — 不要省略 key
```

**好**
```json
{
  "data": {
    "id": "abc-123",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "createdAt": "2026-03-25T10:00:00Z",
    "avatar": null
  }
}
```

---

## 4. 分页

```
列表端点强制:
  ├── Offset 分页: ?page=1&pageSize=20（简单，适合 UI 分页）
  ├── 游标分页: ?cursor=abc&limit=20（更适合大/实时数据集）
  ├── 默认 pageSize: 20，最大 pageSize: 100
  ├── 响应包含分页元数据: total, page, pageSize, hasMore
  ├── 绝不返回无界列表 — 始终分页或限制
  └── 支持排序: ?sort=createdAt&order=desc
```

**好**
```json
{
  "data": [...],
  "meta": {
    "total": 342,
    "page": 2,
    "pageSize": 20,
    "hasMore": true
  }
}
```

---

## 5. 错误响应

```
强制:
  ├── 正确使用标准 HTTP 状态码（见下表）
  ├── 错误体包含: code（机器可读）, message（人类可读）
  ├── 验证错误包含字段级详情
  ├── 绝不向客户端暴露堆栈跟踪、SQL 错误或内部路径
  └── 服务端记录完整错误 — 向客户端返回安全摘要
```

| 状态 | 含义 | 使用场景 |
|------|------|----------|
| 200 | OK | 成功的 GET, PUT, PATCH, DELETE |
| 201 | Created | 成功的 POST（包含 Location header） |
| 204 | No Content | 成功的 DELETE 无响应体 |
| 400 | Bad Request | 无效输入、JSON 格式错误、验证错误 |
| 401 | Unauthorized | 缺少或无效认证 |
| 403 | Forbidden | 已认证但权限不足 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 重复资源、乐观锁失败 |
| 422 | Unprocessable Entity | JSON 有效但语义错误 |
| 429 | Too Many Requests | 速率限制超出 |
| 500 | Internal Server Error | 意外的服务器失败 |

**验证错误示例:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Must be a valid email address" },
      { "field": "name", "message": "Must be at least 2 characters" }
    ]
  }
}
```

---

## 6. 过滤和搜索

```
强制:
  ├── 过滤通过 query params: ?status=active&role=admin
  ├── 搜索通过 query param: ?search=jane（服务器决定搜哪些字段）
  ├── 日期范围: ?createdAfter=2026-01-01&createdBefore=2026-03-01
  ├── 多值: ?status=active,pending（逗号分隔）
  ├── 绝不接受客户端传来的原始 SQL 或查询表达式
  └── 验证并白名单所有过滤参数
```

---

## 7. 版本管理

```
强制:
  ├── 版本在 URL 路径中: /api/v1/, /api/v2/
  ├── 仅破坏性变更时 bump major version
  ├── 弃用期内支持上一版本（最少 3 个月）
  ├── 破坏性变更记录在 changelog 中
  └── 新字段不是破坏性变更 — 客户端应忽略未知字段
```

---

## 8. 速率限制

```
公开 API 强制:
  ├── 每个客户端/API key 实现速率限制
  ├── 返回 429 + Retry-After header
  ├── 包含速率限制 header: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  └── 不同层级设置不同限制（免费 vs 付费）
```

---

## 9. 反模式

```
绝不要:
  ├── URL 中使用动词（/getUser, /deleteOrder）
  ├── GET 请求修改数据
  ├── 向客户端暴露内部错误、堆栈跟踪或 SQL
  ├── 无分页的无界列表响应
  ├── 端点间响应形状不一致
  ├── 接受客户端的原始查询表达式
  ├── 不 bump 版本就破坏性变更
  └── 200 OK 但错误体 — 用正确的状态码
```

---

## REST API 验证清单

- [ ] URL 用名词、复数、kebab-case
- [ ] 正确的 HTTP 方法（GET 读, POST 创建等）
- [ ] 一致响应 envelope（data, error, meta）
- [ ] 所有列表端点分页带元数据
- [ ] 错误响应包含 code + message，无内部暴露
- [ ] 验证错误包含字段级详情
- [ ] API 在 URL 路径中版本化
- [ ] 速率限制带正确 header（公开 API）
- [ ] 时间戳用带时区的 ISO 8601
- [ ] 过滤仅通过白名单 query params
