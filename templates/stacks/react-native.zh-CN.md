# React Native 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 状态管理 — React Query + Zustand

```
强制:
  ├── 所有服务端数据用 React Query (TanStack Query) — 绝不 useEffect + fetch
  ├── 客户端全局状态用 Zustand（auth, theme, 导航状态）
  ├── useState 仅用于本地 UI 状态（开关、表单输入）
  ├── 绝不把服务端数据存在 useState 或 Zustand — 它属于 query cache
  └── 所有查询显式设置 staleTime
```

**好**
```tsx
// 服务端数据 → React Query
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: api.getUsers,
  staleTime: 5 * 60 * 1000,
});

// 客户端状态 → Zustand
const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  logout: () => set({ token: null }),
}));
```

---

## 2. 组件设计

```
强制:
  ├── 组件文件最多 150 行 — 超长则提取子组件
  ├── 动态列表用 FlatList — 绝不 ScrollView + .map()
  ├── 屏幕组件（screens/）和可复用组件（components/）分开
  ├── 一个文件一个组件
  ├── JSX 中无业务逻辑 — 在 return 上方计算
  └── 复杂逻辑用自定义 hooks（useXxx）
```

**坏**
```tsx
<ScrollView>
  {items.map(item => <ItemRow key={item.id} item={item} />)}
</ScrollView>
```

**好**
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  ListEmptyComponent={<EmptyState />}
/>
```

---

## 3. 导航 — React Navigation

```
强制:
  ├── 使用 React Navigation（不用 react-native-router-flux，裸 RN 不用 expo-router）
  ├── 用 RootStackParamList 类型化所有导航参数
  ├── 在集中导航配置中定义所有路由
  ├── Deep linking 在 navigator 中配置 — 不在组件中硬编码
  └── 用条件 navigator 处理 auth 流程（已登录 → app，否则 → auth）
```

**好**
```tsx
type RootStackParamList = {
  Home: undefined;
  UserDetail: { userId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { isLoggedIn } = useAuth();
  return (
    <Stack.Navigator>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="UserDetail" component={UserDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
```

---

## 4. 样式

```
强制:
  ├── 所有样式使用 StyleSheet.create — 绝不用内联 style 对象
  ├── 样式在组件文件底部就近定义
  ├── 颜色、间距、字体使用 theme 对象 — 绝不硬编码
  ├── 响应式: 使用 useWindowDimensions 或百分比布局
  └── 平台特定样式通过 Platform.select 或 .ios.tsx/.android.tsx 文件
```

**坏** — `<View style={{ padding: 16, backgroundColor: '#f5f5f5' }}>`

**好**
```tsx
const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
});
```

---

## 5. 性能优化

```
强制:
  ├── FlatList 带 keyExtractor — 列表绝不 ScrollView
  ├── 列表项组件用 React.memo
  ├── renderItem 和事件处理器用 useCallback 传给 FlatList
  ├── 避免列表项 props 中的匿名函数
  ├── 图片缓存使用 react-native-fast-image
  ├── 最小化 bridge 调用 — 批量状态更新
  └── 优化前先用 Flipper 或 React DevTools profile
```

---

## 6. 平台差异处理

```
强制:
  ├── 标记完成前在 **iOS 和 Android 上都要测试**
  ├── 谨慎使用 Platform.OS 判断 — 优先跨平台组件
  ├── 用 SafeAreaView 或 useSafeAreaInsets 处理安全区域
  ├── 键盘: KeyboardAvoidingView（每平台行为不同）
  ├── 权限: 在使用时请求，说明原因，拒绝时优雅处理
  └── 状态栏: 用 StatusBar 组件管理 — 不要假设默认值
```

---

## 7. 离线与网络

```
适用时:
  ├── React Query 内置缓存用于离线读取
  ├── 使用 @react-native-community/netinfo 检测连接状态
  ├── 显示离线指示器 — 不静默失败
  ├── 离线时排队变更，在线时重放
  └── 所有网络请求设置合理超时
```

---

## 8. 错误处理

```
强制:
  ├── 应用根目录有全局错误边界 — 绝不出现空白崩溃屏
  ├── 每个屏幕有独立的错误边界，隔离失败
  ├── 每次数据获取都要处理 loading、error 和空状态
  ├── 生产构建集成崩溃报告（Sentry, Bugsnag）
  └── 用户友好的错误消息 — 不是原始错误字符串
```

---

## 9. 反模式

```
绝不要:
  ├── ScrollView + .map() 做动态列表（用 FlatList）
  ├── 内联 style 对象（用 StyleSheet.create）
  ├── useEffect 获取数据（用 React Query）
  ├── 硬编码颜色/间距 — 用 theme
  ├── 提交代码中有 console.log
  ├── 忽视平台差异 — 两端都要测
  ├── 忽视键盘避让 — 表单不可用
  └── 大图不缓存 — 用 FastImage
```

---

## React Native 验证清单

- [ ] 服务端数据用 React Query — 无 useEffect + fetch
- [ ] 动态列表用 FlatList — 无 ScrollView + map
- [ ] 组件不超过 150 行
- [ ] 样式用 StyleSheet.create — 无内联对象
- [ ] 颜色/间距用 theme 对象 — 无硬编码值
- [ ] React Navigation 带类型化参数
- [ ] 每个数据获取处理 loading、error、empty 状态
- [ ] iOS 和 Android 上都测试过
- [ ] 安全区域和键盘避让已处理
- [ ] 提交代码中没有 console.log
- [ ] 根目录和每个屏幕都有错误边界
