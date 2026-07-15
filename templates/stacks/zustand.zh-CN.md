# Zustand 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. Store 结构

```
强制:
  ├── 一个域一个 store: useAuthStore, useCartStore, useUIStore
  ├── Zustand 仅用于客户端状态 — 服务端数据用 React Query
  ├── 用 TypeScript 定义 store interface
  ├── 相关状态和 actions 分组
  ├── 每个 store 导出单个自定义 hook
  └── 绝不创建一个包含所有内容的大全局 store
```

**好**
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (credentials) => {
    const { user, token } = await authService.login(credentials);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));
```

---

## 2. Selectors — 最小化重渲染

```
强制:
  ├── 只选组件需要的部分 — 绝不选整个 store
  ├── 每个状态片段用独立 selector
  ├── 通用模式创建可复用的 selector hooks
  └── 对象选择用 shallow 相等比较
```

**坏** — 任何 store 变更都触发重渲染:
```typescript
const store = useAuthStore();
```

**好** — 仅 user 变更时重渲染:
```typescript
const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

// 多值用 shallow:
import { useShallow } from 'zustand/react/shallow';
const { user, isAuthenticated } = useAuthStore(
  useShallow((state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }))
);
```

---

## 3. Actions 和更新

```
强制:
  ├── Actions 定义在 create() 内部 — 不用外部函数
  ├── 状态更新用 set() — 绝不直接修改 state
  ├── Action 内用 get() 读取当前状态
  ├── 异步 action: 在 action 内处理 loading/error
  └── 部分更新: set() 默认合并 — 只传变更的字段
```

**好**
```typescript
addItem: (item) => set((state) => ({
  items: [...state.items, item],
  total: state.total + item.price,
})),

removeItem: (itemId) => set((state) => ({
  items: state.items.filter(i => i.id !== itemId),
})),
```

---

## 4. 中间件

```
需要时:
  ├── persist: localStorage/sessionStorage 持久化
  ├── devtools: Redux DevTools 集成（仅开发环境）
  ├── immer: 复杂嵌套状态的易变式更新
  ├── 带 TypeScript 的中间件栈: create<State>()(devtools(persist(...)))
  └── persist 配置唯一 name 和 version 用于迁移支持
```

**好**
```typescript
export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        addItem: (item) => set((state) => ({ items: [...state.items, item] })),
        clear: () => set({ items: [] }),
      }),
      {
        name: 'cart-storage',
        version: 1,
      }
    ),
    { name: 'CartStore' }
  )
);
```

---

## 5. Slices 模式（大 Store）

```
当 store 超过 10 个 actions 时:
  ├── 拆分为 slices — 每个 slice 管理状态子集
  ├── 在单个 create() 调用中组合 slices
  ├── 每个 slice 有自己的 interface
  └── Slices 可通过 get() 读取其他 slice
```

**好**
```typescript
interface UserSlice {
  user: User | null;
  setUser: (user: User) => void;
}

interface SettingsSlice {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const createUserSlice: StateCreator<UserSlice & SettingsSlice, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

const createSettingsSlice: StateCreator<UserSlice & SettingsSlice, [], [], SettingsSlice> = (set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
});

export const useAppStore = create<UserSlice & SettingsSlice>()((...args) => ({
  ...createUserSlice(...args),
  ...createSettingsSlice(...args),
}));
```

---

## 6. 反模式

```
绝不要:
  ├── Zustand 存储服务端数据 — 用 React Query
  ├── 不用 selectors 直接用整个 store — 导致不必要重渲染
  ├── 整个应用用一个 mega-store — 按域拆分
  ├── 不用 immer 就直接修改 state（state.items.push(x)）
  ├── React 外访问 store 不用 getState()（用 useStore.getState()）
  ├── 可以计算的派生状态也存进 store — 在 selectors 中计算
  └── store actions 中有 console.log
```

---

## Zustand 验证清单

- [ ] 一个域一个 store — 无 mega-stores
- [ ] 仅客户端状态 — 服务端数据在 React Query
- [ ] TypeScript interfaces 类型化
- [ ] 使用 selectors — 无完整 store 订阅
- [ ] 多值选择用 useShallow
- [ ] Actions 在 create() 内部定义
- [ ] persist 中间件配置了 name 和 version
- [ ] 开发环境启用 devtools
- [ ] 不用 immer 则不直接修改状态
- [ ] store 代码中没有 console.log
