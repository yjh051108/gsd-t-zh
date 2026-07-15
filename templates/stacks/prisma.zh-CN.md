# Prisma 标准（检测到 Prisma 时适用）

这些规则是 **强制** 的。违规导致任务失败。没有例外。
适用于 `package.json` 中包含 `prisma` 或 `@prisma/client`，或存在 `schema.prisma` 文件的项目。

---

## 1. Schema 设计

```
强制:
  ├── 只有一个 schema.prisma 文件 — 绝不拆分为多个（用注释分区）
  ├── 使用 @id 配合 autoincrement() 或 uuid() — 绝不应用生成 ID
  ├── 每个模型都有 createdAt DateTime @default(now()) 和 updatedAt DateTime @updatedAt
  ├── camelCase 的 Prisma 模型名用 @map 和 @@map 映射到 snake_case 的 DB 列名/表名
  ├── 同一模型有多个关联到同一张表时定义显式 relation 名称
  ├── 固定集合使用 enum — 绝不使用隐式允许值的 string 字段
  └── 在 WHERE, ORDER BY, JOIN 条件中使用的字段添加 @@index
```

**好**
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      UserRole @default(MEMBER)
  posts     Post[]   @relation("AuthoredPosts")
  reviews   Post[]   @relation("ReviewedPosts")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
  @@index([email])
  @@index([role])
}

enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**坏**
```prisma
model User {
  id   Int    @id @default(autoincrement())
  role String // 应该是 enum
  // 缺少 createdAt, updatedAt, 索引
}
```

---

## 2. Client 初始化

```
强制:
  ├── 创建单例 PrismaClient — 绝不按请求实例化
  ├── 开发环境（热重载）: 缓存在 globalThis 上 — 防止连接池耗尽
  ├── 配置连接池: 池大小匹配预期并发量
  ├── 关闭处理: SIGTERM/SIGINT 时 disconnect
  ├── 开发环境启用查询日志，生产环境关闭
  └── 绝不跨多个文件导入并实例化 PrismaClient — 使用共享模块
```

**好**
```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**坏** — 每个文件都创建新实例:
```typescript
// users.ts
const prisma = new PrismaClient();  // 新实例 — 池泄漏

// orders.ts
const prisma = new PrismaClient();  // 另一个实例 — 另一个连接池
```

---

## 3. 查询 — 避免 N+1

```
强制:
  ├── 对确定需要的关联数据使用 include — 一次查询预加载
  ├── 使用 select 只取需要的字段 — 只需 2 个字段时绝不 fetch 整行
  ├── 绝不在循环中对结果查询关联数据（N+1）
  ├── 统计关联数量使用 _count — 不加载它们
  ├── 复杂聚合使用 groupBy 或 raw SQL — 不在 JavaScript 中聚合
  └── 优先 findMany with where 而非多个 findUnique 调用
```

**好**
```typescript
// 一次查询带关联数据
const users = await prisma.user.findMany({
  where: { role: "ADMIN" },
  select: {
    id: true,
    name: true,
    email: true,
    _count: { select: { posts: true } },
    posts: {
      select: { title: true, status: true },
      where: { status: "PUBLISHED" },
      take: 5,
      orderBy: { createdAt: "desc" },
    },
  },
});
```

**坏** — N+1:
```typescript
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });  // N+1!
}
```

---

## 4. 变更与事务

```
强制:
  ├── 必须原子性操作使用 prisma.$transaction()
  ├── 优先交互式事务（callback）而非顺序事务（array）
  ├── 长操作设置事务超时: $transaction(fn, { timeout: 10000 })
  ├── 创建或更新使用 upsert — 绝不先查再建（竞态条件）
  ├── 批量插入使用 createMany — 绝不循环调用 create()
  ├── 乐观并发: 使用 @updatedAt 或版本字段检测冲突
  └── 绝不将关联数据的事务操作和非事务操作混用
```

**好**
```typescript
// 交互式事务 — 全部成功或全部失败
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: { userId, total, status: "PENDING" },
  });
  await tx.orderItem.createMany({
    data: items.map(item => ({ orderId: order.id, ...item })),
  });
  await tx.inventory.updateMany({
    where: { productId: { in: items.map(i => i.productId) } },
    data: { quantity: { decrement: 1 } },
  });
  return order;
});
```

**坏** — 关联操作没有事务:
```typescript
const order = await prisma.order.create({ data: { userId, total } });
// 如果这一步失败，会留下一个没有 order items 的 order！
await prisma.orderItem.createMany({ data: items.map(i => ({ orderId: order.id, ...i })) });
```

---

## 5. 迁移

```
强制:
  ├── 开发用 prisma migrate dev — 从 schema 变更生成迁移文件
  ├── 生产用 prisma migrate deploy — 仅应用已有迁移文件
  ├── 生产环境绝不使用 prisma db push — 它不生成迁移文件
  ├── 应用前审查生成的 SQL — Prisma 可能做出意外决定
  ├── 迁移命名描述性: npx prisma migrate dev --name add_user_role_column
  ├── 迁移文件提交到 git — 它们是源代码
  ├── 数据迁移: 创建独立脚本，不放在 schema 迁移中
  └── 绝不删除或修改已应用的迁移文件 — 创建新迁移替代
```

**迁移工作流:**
```
1. 编辑 schema.prisma
2. 运行: npx prisma migrate dev --name descriptive_name
3. 审查 prisma/migrations/{timestamp}_{name}/migration.sql 中的生成 SQL
4. 运行: npx prisma generate（重新生成客户端类型）
5. 提交 schema.prisma + 迁移文件 + 更新后的 @prisma/client
```

---

## 6. 种子数据

```
强制:
  ├── 创建 prisma/seed.ts（或 .js）用于开发种子数据
  ├── 种子脚本必须幂等 — 可安全多次运行（使用 upsert）
  ├── 在 package.json 中配置: "prisma": { "seed": "tsx prisma/seed.ts" }
  ├── 使用真实数据 — 不是 "test123" 或 "foo bar"
  ├── 基础引用数据（角色、分类、设置）单独于测试数据
  └── 绝不向生产数据库播种测试数据
```

**好**
```typescript
// prisma/seed.ts
import { prisma } from "../lib/prisma";

async function main() {
  // 引用数据 — 总是 upsert
  for (const role of ["ADMIN", "MEMBER", "VIEWER"]) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role, description: `${role} role` },
    });
  }

  // 仅开发用的测试数据
  if (process.env.NODE_ENV !== "production") {
    await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: { email: "admin@example.com", name: "Admin User", role: "ADMIN" },
    });
  }
}

main().finally(() => prisma.$disconnect());
```

---

## 7. 类型安全

```
强制:
  ├── Schema 变更后运行 prisma generate — 保持类型同步
  ├── 使用 Prisma 生成的类型: Prisma.UserCreateInput, Prisma.UserWhereInput
  ├── 服务层类型从 Prisma 类型派生 — 不重复定义
  ├── 使用 Prisma.UserGetPayload<{ include: { posts: true } }> 获取包含关联的类型
  ├── 数据访问函数返回类型化结果 — 不用 any 或 unknown
  └── 绝不手动将 Prisma 结果 cast 为自定义类型 — 会漂移失步
```

**好**
```typescript
import { Prisma, User } from "@prisma/client";

// 从 Prisma 派生类型
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: { select: { id: true; title: true } } };
}>;

async function getUserWithPosts(id: string): Promise<UserWithPosts | null> {
  return prisma.user.findUnique({
    where: { id },
    include: { posts: { select: { id: true, title: true } } },
  });
}
```

---

## 8. 中间件与扩展

```
强制:
  ├── 使用 Prisma Client Extensions (v4.16+) 替代 middleware — 更好的性能和类型
  ├── 使用扩展实现: 软删除、审计日志、计算字段
  ├── Middleware 在每个查询上运行 — 保持快速，避免 I/O
  ├── 慢查询日志: 测量耗时并在超过阈值时告警的 middleware
  ├── 软删除: 使用添加了 deletedAt 并自动过滤的扩展
  └── 绝不将业务逻辑放在 Prisma middleware — 使用服务层
```

**好** — 软删除扩展:
```typescript
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async delete({ model, args, query }) {
        return prisma[model].update({
          ...args,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});
```

---

## 9. 测试

```
强制:
  ├── 使用独立的测试数据库 — 绝不运行测试到 dev 或 production
  ├── 测试环境设置 DATABASE_URL 指向测试专用数据库
  ├── 测试套件间重置数据库: prisma migrate reset --force（仅测试）
  ├── 使用事务隔离测试: 启动事务 → 测试 → 回滚
  ├── 单元测试: mock PrismaClient 方法（vitest.mock 或 jest.mock）
  ├── 集成测试: 使用真实数据库和测试数据
  └── 测试中绝不使用 prisma db push — 使用 migrate 保持一致性
```

**好** — 用事务做测试隔离:
```typescript
import { prisma } from "../lib/prisma";

beforeEach(async () => {
  // 按正确顺序清表（尊重外键）
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

---

## 10. 性能

```
强制:
  ├── 使用 select 限制列 — 只需 2 个字段时绝不 fetch *
  ├── WHERE 子句中的字段添加 @@index — 尤其是外键
  ├── 大数据集使用游标分页 — 不用高偏移量的 skip/take
  ├── 批量操作: createMany, updateMany, deleteMany — 不用循环
  ├── 监控查询性能: 启用日志，追踪慢查询
  ├── 读密集场景: 考虑 Prisma Accelerate 或读副本
  └── 面向用户的端点绝不使用无分页/无 limit 的 findMany
```

**好** — 游标分页:
```typescript
async function getUsers(cursor?: string, take: number = 20) {
  return prisma.user.findMany({
    take: take + 1,  // 多取一条用于检测 hasMore
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });
}
```

---

## 反模式

```
绝不要:
  ├── 每个请求 new PrismaClient() — 用单例
  ├── N+1 查询: 循环内 findUnique/findFirst — 用 include/select
  ├── 生产环境用 prisma db push — 用 prisma migrate deploy
  ├── 删除或修改已应用的迁移文件 — 创建新迁移
  ├── 关联写操作缺少 $transaction — 数据不一致
  ├── 不用 upsert 的 check-then-create — 竞态条件
  ├── 手动定义与 Prisma 生成类型重复的类型
  ├── 用户端点无分页/limit 的 findMany
  ├── Prisma middleware 中的业务逻辑 — 用服务层
  ├── 测试使用 dev/production 数据库 — 用独立测试 DB
  └── Schema 变更后跳过 prisma generate — 类型会过时
```

---

## Prisma 验证清单

- [ ] PrismaClient 为单例，带 dev 热重载保护
- [ ] 所有模型有 id, createdAt, updatedAt
- [ ] 固定值集合用 enum，查询字段有 @@index
- [ ] snake_case DB 名通过 @map/@@map，Prisma 中用 camelCase
- [ ] include/select 处理关联数据 — 无 N+1 循环
- [ ] 多模型变更使用 $transaction
- [ ] 迁移提交到 git，命名描述性
- [ ] 种子脚本幂等（使用 upsert）
- [ ] 类型从 Prisma 派生，不手动重复
- [ ] 测试数据库独立，套件间重置
- [ ] 列表端点使用游标分页
