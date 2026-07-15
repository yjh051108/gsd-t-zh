# Neo4j 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 数据建模

```
强制:
  ├── 节点表示实体（名词）: (:User), (:Product), (:Order)
  ├── 关系表示动词: -[:PURCHASED]->, -[:FOLLOWS]->
  ├── 节点标签: PascalCase 单数（User, BusinessType — 不是 users）
  ├── 关系类型: UPPER_SNAKE_CASE（PURCHASED, WORKS_AT, BELONGS_TO）
  ├── 属性: camelCase（firstName, createdAt）
  ├── 在"拥有"它们的节点或关系上存储属性
  ├── 关系 **始终** 有方向 — 即使双向查询
  └── 绝不要将关系用作节点（仅在关系需要自己的关系时才具体化）
```

**好**
```cypher
(:User {id: "u-123", name: "Jane", email: "jane@example.com"})
  -[:PURCHASED {purchasedAt: datetime(), amount: 29.99}]->
(:Product {id: "p-456", name: "Widget", category: "Tools"})
```

---

## 2. Cypher 查询模式

```
强制:
  ├── 使用参数化查询 — 绝不字符串拼接
  ├── 使用 MERGE 进行 upsert — CREATE 用于确定新的，MATCH 用于已存在的
  ├── 始终对面向用户的查询 LIMIT 结果
  ├── 关系可能不存在时使用 OPTIONAL MATCH
  ├── 使用 WITH 链接查询阶段 — 提高可读性和性能
  ├── 对子查询优先使用模式理解而非 COLLECT + UNWIND
  └── 在 MATCH 模式中始终指定关系方向
```

**坏**
```cypher
MATCH (u:User) WHERE u.name = '${name}' RETURN u  // 注入风险!
MATCH (u:User)--(p:Product) RETURN u, p            // 无方向，无限制
```

**好**
```cypher
MATCH (u:User {id: $userId})-[:PURCHASED]->(p:Product)
RETURN u.name, p.name, p.category
ORDER BY p.name
LIMIT 50
```

---

## 3. 索引和约束

```
强制:
  ├── 所有 ID 属性上的唯一约束: CREATE CONSTRAINT FOR (u:User) REQUIRE u.id IS UNIQUE
  ├── 索引 WHERE 和 MATCH 查找中使用的属性
  ├── 多属性查找的复合索引
  ├── 搜索字段的全文索引（name, description）
  ├── 使用 EXPLAIN 和 PROFILE 验证查询计划使用索引
  └── 绝不要依赖全节点扫描进行查找
```

**好**
```cypher
// 唯一约束（同时创建索引）
CREATE CONSTRAINT user_id_unique FOR (u:User) REQUIRE u.id IS UNIQUE;

// 常用查找的属性索引
CREATE INDEX user_email_idx FOR (u:User) ON (u.email);

// 复合索引
CREATE INDEX order_status_date FOR (o:Order) ON (o.status, o.createdAt);

// 全文索引
CREATE FULLTEXT INDEX user_search FOR (u:User) ON EACH [u.name, u.email];
```

---

## 4. 事务管理

```
强制:
  ├── 对多语句操作使用显式事务
  ├── 保持事务简短 — 不要在持有锁的同时进行外部 I/O
  ├── 查询使用读事务: session.executeRead()
  ├── 变更使用写事务: session.executeWrite()
  ├── 对瞬态错误使用重试（托管事务中的驱动自动重试）
  └── 使用后始终关闭会话
```

**好**
```typescript
const session = driver.session();
try {
  const result = await session.executeRead(async (tx) => {
    const res = await tx.run(
      'MATCH (u:User {id: $userId})-[:PURCHASED]->(p:Product) RETURN p',
      { userId }
    );
    return res.records.map(r => r.get('p').properties);
  });
  return result;
} finally {
  await session.close();
}
```

---

## 5. 驱动配置

```
强制:
  ├── 启动时创建驱动一次 — 跨请求复用
  ├── 根据工作负载设置 maxConnectionPoolSize（默认 100 通常可以）
  ├── 设置 connectionAcquisitionTimeout（默认 60s — web 应用应更低）
  ├── bolt:// 用于直连，neo4j:// 用于路由（集群）
  ├── 启动时验证连接: driver.verifyConnectivity()
  └── 应用关闭时关闭驱动: driver.close()
```

**好**
```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 10000,
  }
);

await driver.verifyConnectivity();

// 关闭时:
process.on('SIGTERM', () => driver.close());
```

---

## 6. 性能

```
强制:
  ├── 开发期间 PROFILE 查询以检查计划和 db 命中
  ├── 使用索引 — 全节点扫描是 O(n) 并会严重影响性能
  ├── 避免无上限的可变长路径: -[:FOLLOWS*1..5]-> 而非 -[:FOLLOWS*]->
  ├── 在查询早期使用 LIMIT — 不仅仅在末尾
  ├── 批量大写入（每事务 1000-5000 个节点）
  └── 可用时使用 APOC 进行批量操作
```

**坏** — 无上限的可变长路径:
```cypher
MATCH (u:User)-[:FOLLOWS*]->(f:User) RETURN f  // 扫描整个图!
```

**好**
```cypher
MATCH (u:User {id: $userId})-[:FOLLOWS*1..3]->(f:User)
RETURN DISTINCT f.id, f.name
LIMIT 100
```

---

## 7. APOC 模式

```
APOC 可用时:
  ├── apoc.periodic.iterate 用于大批量操作
  ├── apoc.merge.node 用于带标签的条件 upsert
  ├── apoc.path.expandConfig 用于带过滤器的复杂遍历
  ├── apoc.export.json 用于数据转储
  └── 检查 APOC 版本与 Neo4j 版本的兼容性
```

---

## 8. 反模式

```
绝不要:
  ├── Cypher 中的字符串拼接 — 使用参数 ($param)
  ├── 无 LIMIT 的无界查询
  ├── 无上限的可变长路径 (-[:REL*]->)
  ├── 查找属性上缺少索引
  ├── 每个请求创建新驱动 — 复用驱动
  ├── 在节点属性中存储大 blob — 使用外部存储
  ├── 密集连接节点（超节点 > 100K 关系）而没有优化
  └── 关系应该使用的地方使用节点（反之亦然）
```

---

## Neo4j 验证清单

- [ ] 仅使用参数化查询 — 无字符串拼接
- [ ] 所有 ID 属性上有唯一约束
- [ ] 所有 WHERE/MATCH 查找属性上有索引
- [ ] 所有查询都有 LIMIT
- [ ] 可变长路径有上限
- [ ] 显式读/写事务
- [ ] 驱动创建一次并复用
- [ ] 使用后关闭会话
- [ ] 复杂查询运行了 PROFILE
- [ ] 节点标签 PascalCase，关系类型 UPPER_SNAKE_CASE
