# GraphQL 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. Schema 设计

```
强制:
  ├── Schema-first 设计 — 定义 schema，然后实现 resolvers
  ├── 类型使用 PascalCase: User, OrderItem
  ├── 字段使用 camelCase: firstName, createdAt
  ├── 枚举值使用 UPPER_SNAKE_CASE: ACTIVE, PENDING_REVIEW
  ├── 突变使用输入类型: CreateUserInput, UpdateOrderInput
  ├── 每个突变返回受影响的类型（不只是 Boolean）
  └── 为所有类型和字段添加描述 — 它们驱动文档
```

**好**
```graphql
"""系统中的一个注册用户。"""
type User {
  id: ID!
  """用户的显示名称。"""
  displayName: String!
  email: String!
  role: UserRole!
  orders(first: Int = 20, after: String): OrderConnection!
  createdAt: DateTime!
}

enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

input CreateUserInput {
  displayName: String!
  email: String!
  role: UserRole = MEMBER
}
```

---

## 2. 查询设计

```
强制:
  ├── 单数资源: user(id: ID!): User
  ├── 复数集合: users(first: Int, after: String, filter: UserFilter): UserConnection!
  ├── 对分页列表使用连接模式（Relay）
  ├── 接受过滤器输入类型 — 不是单独的过滤器参数
  ├── 绝不过度返回列表 — 始终要求分页参数
  └── 单数查找返回可空值（用户可能不存在）
```

**好**
```graphql
type Query {
  user(id: ID!): User
  users(first: Int = 20, after: String, filter: UserFilter): UserConnection!
}

input UserFilter {
  role: UserRole
  isActive: Boolean
  search: String
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}
```

---

## 3. 突变设计

```
强制:
  ├── 动词优先命名: createUser, updateOrder, deleteComment
  ├── 接受单个输入参数: createUser(input: CreateUserInput!): User!
  ├── 返回变更后的对象 — 不是 Boolean 或通用状态
  ├── 使用联合类型进行错误处理（首选）或抛出错误
  ├── 在 resolvers 中验证输入 — schema 类型是不够的
  └── 突变尽可能幂等
```

**好**
```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): DeleteUserPayload!
}

type CreateUserPayload {
  user: User
  errors: [ValidationError!]
}

type ValidationError {
  field: String!
  message: String!
}
```

---

## 4. Resolver 模式

```
强制:
  ├── 薄 resolvers — 委托给服务/数据层，不要在 resolvers 中放业务逻辑
  ├── 对 N+1 防护使用 DataLoader — 批量缓存数据库查找
  ├── 在 resolvers 或中间件中进行 auth 检查 — 不在服务层
  ├── 未找到返回 null，未授权/禁止抛出
  └── 带上下文记录错误（查询名称、变量、用户 ID）
```

**好**
```typescript
const resolvers = {
  Query: {
    user: async (_, { id }, { dataSources, user }) => {
      if (!user) throw new AuthenticationError('Must be logged in');
      return dataSources.userService.getById(id);
    },
  },
  User: {
    orders: (parent, args, { dataSources }) =>
      dataSources.orderLoader.load({ userId: parent.id, ...args }),
  },
};
```

---

## 5. N+1 防护 — DataLoader

```
强制:
  ├── 对在列表中逐项解析的任何字段使用 DataLoader
  ├── 每个请求创建 loaders（在上下文工厂中创建新实例）
  ├── batch 函数接收键数组，返回相同顺序的结果数组
  └── 缓存是请求范围的 — 不在请求之间共享
```

**好**
```typescript
const userLoader = new DataLoader<string, User>(async (ids) => {
  const users = await db.query('SELECT * FROM users WHERE id = ANY($1)', [ids]);
  const userMap = new Map(users.map(u => [u.id, u]));
  return ids.map(id => userMap.get(id) ?? new Error(`User ${id} not found`));
});
```

---

## 6. 客户端模式

```
强制:
  ├── 查询与组件同位置 — 查询文件在组件旁边
  ├── 对共享字段选择使用 fragments
  ├── 命名所有操作: query GetUser, mutation CreateOrder
  ├── 使用生成类型（graphql-codegen）— 绝不手动类型化查询结果
  ├── 为每个查询处理加载、错误和空状态
  └── 突变后更新缓存: 重新获取或直接更新缓存
```

---

## 7. 反模式

```
绝不要:
  ├── 无分页的无限列表查询
  ├── resolvers 中的业务逻辑 — 委托给服务
  ├── N+1 查询 — 使用 DataLoader
  ├── 匿名操作（未命名的查询/突变）
  ├── 没有深度限制的深度嵌套查询
  ├── 从突变返回 Boolean — 返回受影响的类型
  ├── 过度获取: 需要两个字段却请求所有字段
  └── 手动类型化查询结果 — 使用 codegen
```

---

## GraphQL 验证清单

- [ ] Schema-first，所有类型/字段有描述
- [ ] 分页列表使用连接模式
- [ ] 所有突变返回受影响的类型（不是 Boolean）
- [ ] 使用 DataLoader 进行 N+1 防护
- [ ] Resolvers 中有输入验证
- [ ] Resolvers 或中间件中有 auth 检查
- [ ] 操作已命名（query GetUser，不是匿名的）
- [ ] 通过 codegen 生成类型
- [ ] 客户端处理加载、错误、空状态
- [ ] 配置了查询深度限制
