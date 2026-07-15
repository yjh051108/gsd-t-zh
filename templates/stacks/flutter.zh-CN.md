# Flutter 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 状态管理 — Riverpod

```
强制:
  ├── 使用 Riverpod 进行状态管理 — 除了本地 UI 之外不要使用 setState
  ├── 每个数据源一个 Provider（API、本地存储、计算）
  ├── 对带加载/错误状态的服务器数据使用 AsyncNotifierProvider
  ├── 对简单开关/过滤器使用 StateProvider
  ├── 绝不在 StatefulWidget setState 中存储服务器数据
  └── 响应式读取用 ref.watch，一次性操作用 ref.read（onTap）
```

**坏**
```dart
class _MyState extends State<MyWidget> {
  List<User> users = [];
  void initState() {
    super.initState();
    fetchUsers().then((u) => setState(() => users = u));
  }
}
```

**好**
```dart
@riverpod
class UsersNotifier extends _$UsersNotifier {
  @override
  Future<List<User>> build() => userRepository.getAll();
}

// 在 widget 中:
final users = ref.watch(usersNotifierProvider);
users.when(
  data: (list) => UserListView(users: list),
  loading: () => const LoadingSkeleton(),
  error: (e, _) => ErrorView(message: e.toString()),
);
```

---

## 2. Widget 设计

```
强制:
  ├── 每个 widget 文件最多 150 行 — 提取子 widget
  ├── 优先 StatelessWidget — 使用带 Riverpod 的 ConsumerWidget
  ├── 将 build 方法的子树提取为单独的 widgets（不是方法）
  ├── 主要 widget 每个文件一个
  ├── 尽可能使用 const 构造函数
  └── build() 中没有业务逻辑 — 移到 providers/notifiers
```

**坏** — 返回 widget 树的 `Widget _buildHeader()` 方法。

**好** — 将 `HeaderWidget` 提取为独立的 `ConsumerWidget`。

---

## 3. 导航

```
强制:
  ├── 使用 go_router 进行声明式路由
  ├── 在单个路由器配置文件中定义所有路由
  ├── 使用命名路由 — 绝不在 widgets 中硬编码路径字符串
  ├── 在路由器配置中处理深度链接
  └── 在路由器守卫中重定向未认证用户 — 不在 widgets 中
```

**好**
```dart
final router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomePage()),
    GoRoute(path: '/users/:id', builder: (_, state) =>
      UserDetailPage(id: state.pathParameters['id']!)),
  ],
  redirect: (context, state) {
    final isLoggedIn = ref.read(authProvider).isLoggedIn;
    if (!isLoggedIn) return '/login';
    return null;
  },
);
```

---

## 4. 数据模型

```
强制:
  ├── 使用 freezed 创建带 copyWith、== 和序列化的不可变数据类
  ├── 通过 json_serializable 或 freezed 的 fromJson/toJson 进行 JSON 序列化
  ├── 绝不在层之间使用原始 Map<String, dynamic>
  ├── 分离模型: API DTO → 领域模型 → UI ViewModel（如需要）
  └── 对状态联合使用 sealed classes（Dart 3）
```

**好**
```dart
@freezed
class User with _$User {
  const factory User({
    required String id,
    required String name,
    required String email,
    required UserRole role,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}
```

---

## 5. 仓储模式

```
强制:
  ├── 所有 API/DB 调用通过仓储类 — widgets 绝不直接调用 HTTP
  ├── 仓储返回领域模型 — 不是原始 JSON 或 Response 对象
  ├── 在仓储中处理错误 — 抛出类型化异常
  ├── 抽象仓储接口以实现可测试性
  └── 使用 dio 或 http 包 — 为认证/日志配置拦截器
```

---

## 6. 平台特定代码

```
强制:
  ├──  sparingly 使用 Platform.isAndroid/isIOS 检查 — 优先使用自适应 widgets
  ├── 平台通道: 定义清晰的 Dart 接口，在两端处理错误
  ├── 标记任务完成前在两个平台上测试
  ├── 使用 device_info_plus 进行运行时能力检测
  └── 优雅处理权限 — 请求前解释原因
```

---

## 7. 性能

```
强制:
  ├── 尽可能使用 const widgets — 防止不必要的重建
  ├── 对长列表使用 ListView.builder — 绝不用 ListView with children 处理 20+ 项
  ├── 用 CachedNetworkImage 缓存图片 — 不是 Image.network
  ├── 避免重建整个 widget 树 — 使用细粒度 providers
  ├── 优化前用 Flutter DevTools 分析
  └── 最小化 widget 深度 — 深度嵌套损害可读性和性能
```

---

## 8. 测试

```
强制:
  ├── 对 providers、notifiers 和业务逻辑进行单元测试
  ├── 使用 pumpWidget 对 UI 组件进行 widget 测试
  ├── 对关键用户流程进行集成测试
  ├── 使用 mocktail 进行 mock — 不用 mockito（null-safety 友好）
  ├── 测试加载、错误和空状态 — 不仅仅是正常路径
  └── 对复杂的自定义 widgets 进行 golden 测试（可选但推荐）
```

---

## 9. 反模式

```
绝不要:
  ├── 对服务器数据使用 setState（使用 Riverpod）
  ├── 层之间使用原始 Map<String, dynamic> — 使用类型化模型
  ├── build 方法超过 80 行 — 提取 widgets
  ├── 硬编码字符串 — 使用常量或 l10n
  ├── 嵌套回调超过 2 层 — 使用 async/await
  ├── 在 build() 中使用 context.read — 使用 ref.watch
  ├── 忽略 dispose() — 始终清理 controllers 和 streams
  └── 用 print() 记录日志 — 使用 logger 包
```

---

## Flutter 验证清单

- [ ] 使用 Riverpod 进行状态管理 — 服务器数据不用 setState
- [ ] Widgets 在 150 行内，使用 const 构造函数
- [ ] go_router 配合命名路由 — 无硬编码路径字符串
- [ ] 所有数据使用 freezed 模型 — 无原始 Maps
- [ ] 仓储模式 — widgets 绝不直接调用 HTTP
- [ ] 每个异步 widget 处理加载、错误和空状态
- [ ] 动态列表使用 ListView.builder
- [ ] 测试覆盖 providers、widgets 和关键流程
- [ ] 在 iOS 和 Android 上都测试过
- [ ] 提交的代码中没有 print()
