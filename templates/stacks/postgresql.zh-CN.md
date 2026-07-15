# PostgreSQL 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 命名规范

```
强制:
  ├── 表名: snake_case，复数 (users, order_items)
  ├── 列名: snake_case，单数 (first_name, created_at)
  ├── 主键: id（分布式系统优先使用 UUID 而非 serial）
  ├── 外键: {被引用表名单数}_id (user_id, order_id)
  ├── 索引: idx_{表名}_{列名} (idx_users_email)
  ├── 约束: {类型}_{表名}_{列名} (uq_users_email, fk_orders_user_id)
  ├── 枚举: snake_case 单数 (user_role, order_status)
  └── 布尔列: is_ 或 has_ 前缀 (is_active, has_verified_email)
```

---

## 2. 表结构设计

```
强制:
  ├── 每张表必须有: id (PK), created_at (timestamptz DEFAULT now()), updated_at
  ├── 使用 timestamptz — 绝不使用不带时区的 timestamp
  ├── 分布式或对外 API 暴露的系统优先使用 UUID 作为主键
  ├── 使用合适的类型: text（而非 varchar）, numeric（货币不用 float）
  ├── 默认 NOT NULL — 仅在有明确理由时才允许 NULL
  ├── 外键带 ON DELETE 策略（CASCADE, SET NULL, RESTRICT —  deliberate 选择）
  └── 存在适当关系型 schema 时绝不存 JSON — jsonb 仅用于真正非结构化数据
```

**好**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email)
);
```

---

## 3. 迁移

```
强制:
  ├── 一次迁移只做一次变更 — 绝不合并无关的 schema 变更
  ├── 生产环境的迁移是前向的 — 绝不编辑已部署的迁移文件
  ├── 命名格式: {时间戳}_{描述}.sql (20260325_add_users_table.sql)
  ├── 每个迁移必须可逆 — 包含 down/rollback 部分
  ├── 在部署到生产前，在生产数据副本上测试迁移
  └── 未经用户批准绝不使用 DROP COLUMN 或 DROP TABLE（破坏性操作保护）
```

---

## 4. 索引策略

```
强制:
  ├── 为每个外键列创建索引
  ├── 为 WHERE, JOIN, ORDER BY 中使用的列创建索引
  ├── 常见过滤模式使用部分索引: WHERE is_active = true
  ├── 复合索引按查询列顺序创建（最左前缀规则）
  ├── jsonb、数组和全文搜索列使用 GIN 索引
  ├── 绝不凭推测创建索引 — 先 profile 查询（EXPLAIN ANALYZE）
  └── 监控未使用的索引并删除
```

**好**
```sql
-- 外键索引
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- 常见查询模式的复合索引
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- 部分索引 — 仅活跃用户
CREATE INDEX idx_users_active_email ON users (email) WHERE is_active = true;

-- jsonb 查询的 GIN 索引
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);
```

---

## 5. 查询模式

```
强制:
  ├── 使用参数化查询 — 绝不拼接 SQL 字符串
  ├── SELECT 只取需要的列 — 绝不 SELECT *
  ├── 所有面向用户的查询使用 LIMIT — 防止无界结果集
  ├── 存在性检查用 EXISTS — 不用 COUNT(*) > 0
  ├── 可读性使用 CTE (WITH) — 但不在性能上使用（CTE 可能是优化屏障）
  ├── 等价情况下优先 JOIN 而非子查询
  └── 需要确定性结果时始终包含 ORDER BY
```

**坏**
```sql
SELECT * FROM users WHERE name LIKE '%' || $1 || '%';
SELECT COUNT(*) FROM orders WHERE user_id = $1;  -- 仅检查存在性
```

**好**
```sql
SELECT id, email, display_name FROM users WHERE name ILIKE '%' || $1 || '%' LIMIT 50;
SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1);
```

---

## 6. 连接管理

```
强制:
  ├── 使用连接池（PgBouncer 或 ORM/driver 内置池）
  ├── 池大小基于工作负载 — 不是无限大
  ├── 使用后关闭/释放连接 — 绝不泄漏
  ├── 在应用连接上设置 statement_timeout（如 30s）
  ├── 重读负载使用读副本
  └── Serverless: 使用 Supabase 连接池或 PgBouncer — 非直连
```

---

## 7. 事务管理

```
强制:
  ├── 多语句操作包装在事务中
  ├── 事务尽量短 — 不在持有锁时进行 I/O
  ├── 使用合适的隔离级别（默认 READ COMMITTED — 对大多数情况足够）
  ├── 死锁用重试逻辑处理（最多 3 次重试）
  └── 绝不遗留未关闭的事务 — 总是 COMMIT 或 ROLLBACK
```

---

## 8. SQL 中的图模式

在 PostgreSQL 中实现图结构（邻接表、知识图谱、层次结构）时:

```
模式:
  ├── 节点表: 每种实体类型一张表，UUID 主键
  ├── 边表（连接表）: {源}_id + {目标}_id + 元数据列
  │    有权图添加 relevance_score, weight, 或 edge_count
  ├── 层次结构: parent_id 自引用 FK + 递归 CTE 遍历
  ├── 边表的两个 FK 列都建索引
  ├── 可复现部署的稳定种子 UUID（确定性 UUID 格式）
  └── 频繁遍历的路径使用内存缓存（LRU, 5 分钟 TTL）
```

**层次结构遍历 — 递归 CTE:**
```sql
WITH RECURSIVE ancestors AS (
  SELECT id, name, parent_id, 0 AS depth
  FROM graph_business_types
  WHERE id = $1
  UNION ALL
  SELECT t.id, t.name, t.parent_id, a.depth + 1
  FROM graph_business_types t
  JOIN ancestors a ON t.id = a.parent_id
)
SELECT * FROM ancestors ORDER BY depth;
```

**加权边查询:**
```sql
SELECT w.id, w.name, e.relevance_score
FROM graph_edges_bt_workflow e
JOIN graph_workflows w ON w.id = e.workflow_id
WHERE e.business_type_id = $1
ORDER BY e.relevance_score DESC
LIMIT 8;
```

**规则:**
- 边表的两个 FK 列都建索引
- 节点删除时边使用 ON DELETE CASCADE
- 昂贵的多跳遍历考虑物化视图
- 深层图（5+ 跳）评估 Neo4j 是否更合适

---

## 9. 反模式

```
绝不要:
  ├── 应用查询中使用 SELECT *
  ├── SQL 字符串拼接 — 仅使用参数化查询
  ├── 无 LIMIT 的无界查询
  ├── 不带时区的 timestamp — 始终使用 timestamptz
  ├── 金额使用 float/double — 使用 numeric 或 integer（分）
  ├── 将结构化关系型数据存在 jsonb
  ├── 外键缺少索引
  ├── 持有锁的长时间运行事务
  └── Serverless 不使用连接池就直连数据库
```

---

## PostgreSQL 验证清单

- [ ] 命名遵循规范（snake_case, 表复数, 列单数）
- [ ] 每张表有 id, created_at, updated_at
- [ ] 使用 timestamptz — 非 timestamp
- [ ] 所有外键有索引
- [ ] 仅使用参数化查询 — 无字符串拼接
- [ ] 所有面向用户的查询有 LIMIT
- [ ] 已配置连接池
- [ ] 迁移前向且可逆
- [ ] 应用代码中没有 SELECT *
- [ ] 图边表在两个 FK 列上有索引（如适用）
