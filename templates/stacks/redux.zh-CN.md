# Redux Toolkit 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 只用 RTK — 不用传统 Redux

```
强制:
  ├── 使用 @reduxjs/toolkit (RTK) — 绝不手动 action creators/reducers 的传统 redux
  ├── 所有状态切片用 createSlice
  ├── 用 configureStore — 绝不用 createStore
  ├── 服务端数据用 RTK Query — 绝不手动 async thunk 调 API
  └── 使用 TypeScript + 类型化 hooks（useAppSelector, useAppDispatch）
```

---

## 2. Slice 设计

```
强制:
  ├── 一个域一个 slice: userSlice, cartSlice, uiSlice
  ├── slice 命名清晰: name: 'auth', name: 'cart'
  ├── 用 TypeScript 定义 state interface
  ├── reducers 只关注一件事 — 保持专注
  ├── 使用 prepare callbacks 做 action payload 加工
  └── 单独导出 actions 和 reducer
```

**好**
```typescript
interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.status = 'succeeded';
    },
    logout: (state) => {
      state.user = null;
      state.status = 'idle';
    },
  },
});

export const { setUser, logout } = authSlice.actions;
export default authSlice.reducer;
```

---

## 3. RTK Query — 服务端数据

```
强制:
  ├── 所有 API 调用用 RTK Query — 绝不 createAsyncThunk 获取数据
  ├── 每个后端服务定义一个 API slice
  ├── 用基于 tag 的缓存失效 — 不用手动缓存更新
  ├── 所有端点类型化 request/response
  ├── 用 hook 结果处理 loading, error, empty 状态
  └── 设置 keepUnusedDataFor 控制缓存生命周期
```

**好**
```typescript
export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], UserFilters>({
      query: (filters) => ({ url: '/users', params: filters }),
      providesTags: ['User'],
    }),
    getUser: builder.query<User, string>({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    createUser: builder.mutation<User, CreateUserInput>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const { useGetUsersQuery, useGetUserQuery, useCreateUserMutation } = usersApi;
```

---

## 4. Store 配置

```
强制:
  ├── configureStore 带类型化 RootState 和 AppDispatch
  ├── 添加 RTK Query middleware 做缓存管理
  ├── 创建类型化 hooks: useAppSelector, useAppDispatch
  ├── 开发环境默认启用 Redux DevTools
  └── Store 配置在单一 store.ts 文件中
```

**好**
```typescript
// store.ts
export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    [usersApi.reducerPath]: usersApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(usersApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// hooks.ts
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppDispatch: () => AppDispatch = useDispatch;
```

---

## 5. Selectors

```
强制:
  ├── 派生/计算状态用 createSelector (reselect)
  ├── 选择最小状态 — 绝不选整个 slice
  ├── selector 与 slice 文件就近定义
  ├── selector 命名: select{Thing}（selectActiveUsers, selectCartTotal）
  └── 过滤/排序/计算数据用记忆化 selector
```

**好**
```typescript
// 在 authSlice.ts 中
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.user;

// 记忆化计算 selector
export const selectActiveUsers = createSelector(
  [(state: RootState) => state.users.list],
  (users) => users.filter(u => u.isActive)
);
```

---

## 6. 反模式

```
绝不要:
  ├── 传统 redux（createStore, 手动 action types, switch reducers）
  ├── 用 createAsyncThunk 调 API — 用 RTK Query
  ├── 组件中选择整个 slice
  ├── 在 slices 中存储服务端数据 — 用 RTK Query
  ├── 在 createSlice reducers 外修改状态（Immer 只在内部工作）
  ├── 字符串 action types — 用 createSlice 自动生成的类型
  ├── 在 useEffect 中 dispatch 获取数据 — 用 RTK Query hooks
  └── reducers 或 slices 中有 console.log
```

---

## Redux Toolkit 验证清单

- [ ] 只用 RTK — 无传统 redux 模式
- [ ] 所有状态管理用 createSlice
- [ ] 所有 API 调用用 RTK Query — 无 createAsyncThunk 获取数据
- [ ] 变更时用基于 tag 的缓存失效
- [ ] 类型化 store（RootState, AppDispatch, 类型化 hooks）
- [ ] 计算状态用 createSelector
- [ ] 选择最小状态 — 无完整 slice 订阅
- [ ] Store 配置了 RTK Query middleware
- [ ] 通过 hook 结果处理 loading, error, empty 状态
- [ ] reducers 或 slices 中没有 console.log
