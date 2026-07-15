# React 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 服务端状态 — React Query

```
强制:
  ├── 所有服务端数据获取用 React Query — 绝不 useEffect + fetch
  ├── 服务端数据绝不存 useState — 它属于 query cache
  ├── 读取用 useQuery，写入用 useMutation
  └── 显式设置 staleTime — 不依赖默认值
```

**坏** — `useEffect(() => { fetch(...).then(setUsers); }, []);`

**好**
```tsx
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: api.getUsers,
  staleTime: 5 * 60 * 1000,
});
```

---

## 2. 组件设计

```
强制:
  ├── 组件文件最多 150 行 — 超长提取
  ├── 容器/展示拆分: 容器获取数据，展示组件渲染 UI
  ├── 复杂逻辑提取到自定义 hooks（useXxx）
  ├── 一个文件一个组件
  └── JSX 中无业务逻辑 — 在 return 上方计算
```

**坏** — 300 行组件混入 fetch、transform 和 render 逻辑。

**好**
```tsx
// 容器获取; 展示渲染
function UserListContainer() {
  const { data } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  return <UserList users={data ?? []} />;
}
function UserList({ users }: { users: User[] }) {
  return <ul>{users.map(u => <UserRow key={u.id} user={u} />)}</ul>;
}
```

---

## 3. Props 规范

```
强制:
  ├── Props 定义为 TypeScript interfaces
  ├── 在函数签名中解构 props
  ├── 不用 defaultProps — 用默认参数值代替
  └── 超过 2 层避免 prop drilling — 用 Context 或组合
```

**好**
```tsx
interface ButtonProps { label: string; variant?: 'primary' | 'secondary'; }
function Button({ label, variant = 'primary' }: ButtonProps) { ... }
```

---

## 4. Key 属性规则

```
强制:
  ├── 动态（增/删/重排）列表绝不使用数组索引作为 key
  ├── 使用数据中的稳定唯一 ID（item.id, item.slug）
  └── 绝不在渲染时生成 key（Math.random(), Date.now()）
```

**坏** — `items.map((item, i) => <Row key={i} />)`

**好** — `items.map(item => <Row key={item.id} />)`

---

## 5. Hooks 规则

```
强制:
  ├── Hook 仅在顶层调用 — 绝不放在条件或循环中
  ├── 绝不在条件中调用 Hook — 用提前 return 重构
  ├── 自定义 Hook 必须以 "use" 开头
  └── 一个 Hook 只关注一个功能
```

**坏** — `if (isLoggedIn) { const data = useUserData(); }`

**好** — 无条件调用 `useUserData()`；未登录时在 JSX 中提前 return。

---

## 6. 记忆化

```
仅在必要时使用 — 先 profile，再优化:
  ├── React.memo: 父组件频繁重渲染且子组件 props 很少变化时
  ├── useMemo: 仅用于计算昂贵的操作（非 string/array 字面量）
  └── useCallback: 函数传给 memoized 子组件或是 useEffect 依赖时
```

**坏** — `const label = useMemo(() => \`Hello, ${name}\`, [name]);`（微不足道 — 无收益）

**好** — `const sorted = useMemo(() => items.sort(expensiveSort), [items]);`

---

## 7. 懒加载

```
路由级组件强制:
  ├── 用 React.lazy() + Suspense 包裹
  ├── 始终提供 Suspense fallback（骨架屏或 spinner — 不用 null）
  └── 相关路由分在同一 lazy chunk 以减少往返
```

```tsx
const Dashboard = React.lazy(() => import('./Dashboard'));
<Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>
```

---

## 8. 错误边界

```
强制:
  ├── 每个路由和主要功能区域包裹 ErrorBoundary
  ├── 显示用户友好的 fallback UI — 绝不清屏
  ├── componentDidCatch 中记录到错误追踪（Sentry）
  └── 使用细粒度边界 — 一个顶层边界不够
```

---

## 9. 无障碍访问（a11y）

```
强制:
  ├── 使用语义化 HTML（button, nav, main, header, section）
  ├── 所有交互元素必须键盘可访问（Tab, Enter, Escape）
  ├── 图片需要 alt 文本（装饰性用 alt=""）
  ├── 表单输入必须有关联 <label>（htmlFor + id）
  ├── 弹窗: 焦点 trapped inside，关闭时恢复，Escape 关闭
  ├── 仅图标按钮需要 aria-label
  └── 绝不移除焦点轮廓 — 样式化它，不要隐藏它
```

**坏** — `<div onClick={del}>Delete</div>` / `<img src={x} />`

**好** — `<button onClick={del} aria-label="Delete">Delete</button>` / `<img src={x} alt="Profile photo" />`

---

## 10. 状态管理 — 何时用什么

```
强制 — 为数据类型选对工具:
  ├── UI 开关、表单输入              → useState
  ├── 复杂本地状态（多步骤）          → useReducer
  ├── 服务端/API 数据                 → React Query（绝不用 useState）
  ├── Auth 会话、权限                 → React Context
  ├── 主题偏好                        → React Context + localStorage
  └── URL 状态（页面、过滤器）        → React Router (useSearchParams)
```

**规则:**
- 不在本地状态重复服务端状态 — React Query 是 API 数据的唯一真相源
- 按需提升 — 如果两个兄弟组件需要同一状态，提升到父组件，不是全局 store
- 派生而非存储 — 如果值可以从现有状态计算，就计算它

**坏** — 存储派生状态:
```tsx
const [users, setUsers] = useState(allUsers);
const [filteredUsers, setFilteredUsers] = useState([]);
const [userCount, setUserCount] = useState(0);
```

**好** — 从源派生:
```tsx
const [filter, setFilter] = useState('all');
const filteredUsers = useMemo(
  () => users.filter(u => filter === 'all' || u.status === filter),
  [users, filter]
);
const userCount = filteredUsers.length;
```

---

## 11. 表单管理 — react-hook-form + Zod

```
使用表单时强制:
  ├── 一个 Zod schema 对应一个表单 — schema 是验证的唯一真相源
  ├── 使用 react-hook-form 配合 zodResolver — 不在事件处理器中验证
  ├── 字段级错误显示在字段下方 — 不用 toast
  ├── 提交中禁用提交按钮
  ├── 用 noValidate 在 <form> 上 — 浏览器验证与自定义验证冲突
  └── 服务端错误用 setError('root', ...)
```

**好**
```tsx
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});
type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" {...register('email')} />
      {errors.email && <span className="error">{errors.email.message}</span>}
      <button type="submit" disabled={isSubmitting}>Save</button>
    </form>
  );
}
```

---

## 12. React 命名规范

```
强制:
  ├── 组件:      PascalCase          (UserList.tsx, DataTable.tsx)
  ├── Hooks:     camelCase + use     (useAuth.ts, useUsers.ts)
  ├── Services:  camelCase + Service (userService.ts)
  ├── 事件处理:  handle 前缀        (handleClick, handleSubmit)
  ├── 回调 props: on 前缀          (onClick, onClose, onChange)
  ├── 布尔状态:  is/has/can 前缀   (isOpen, hasError, canEdit)
  ├── 文件夹:    kebab-case         (user-settings/, danger-window/)
  └── 非组件文件: camelCase         (helpers.ts, permissions.ts)
```

---

## 13. 反模式

```
绝不要:
  ├── useEffect 获取数据（用 React Query — 第 1 节）
  ├── 超过 2 层 prop drilling
  ├── 动态列表用数组索引作为 key（第 4 节）
  ├── 条件式 Hook 调用（第 5 节）
  ├── 直接状态突变: state.list.push(x) — 返回新对象/数组
  ├── 提交代码中有 console.log
  ├── 可派生的状态用 useState 存储（第 10 节）
  ├── 事件处理器中手动验证表单（用 react-hook-form + zod — 第 11 节）
  └── 不清理就用 dangerouslySetInnerHTML — 见 _security.md
```

---

## React 验证清单

- [ ] 服务端数据用 React Query 获取 — 无 `useEffect` + fetch
- [ ] 组件不超过 150 行
- [ ] 数据获取组件使用 Container/Presenter 模式
- [ ] 所有 props 用 TypeScript interfaces 类型化
- [ ] 动态列表不用数组索引作为 key
- [ ] 无条件 Hook 调用
- [ ] 记忆化有依据 — 非预防性
- [ ] 路由组件用 `React.lazy` + `Suspense` 带 fallback
- [ ] `ErrorBoundary` 包裹每个主要功能区域
- [ ] 所有交互元素带键盘访问和 ARIA 标签
- [ ] 提交代码中没有 `console.log`
- [ ] 无直接状态突变 — 始终返回新对象/数组
- [ ] `dangerouslySetInnerHTML` 使用已按 `_security.md` 审查
- [ ] 状态工具匹配数据类型（useState/useReducer/Context/React Query/Router）
- [ ] 无派生状态存 useState — 从源计算
- [ ] 表单用 react-hook-form + zod — 无手动验证
- [ ] 遵循 React 命名规范（handle*, on*, is/has/can）
