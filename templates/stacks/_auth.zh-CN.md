# 认证标准（通用 — 所有项目）

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 注册 — 先邮箱，后密码

```
强制:
  ├── 注册仅收集邮箱 + 应用特定字段 — 注册时不要密码
  ├── 注册后，发送"设置密码"邮件（与忘记密码相同的流程）
  ├── 设置密码链接是一次性的、有时间限制的令牌（15-60 分钟）
  ├── 用户点击链接 → 进入设置密码页面 → 设置密码 → 已登录
  ├── 这消除了：临时密码、强制密码更改、传输中的密码风险
  └── 如果链接过期，用户可以请求新的（与忘记密码相同）
```

**为什么一个流程就够了**: "设置密码"和"忘记密码"是相同的操作 — 生成令牌、发送邮件、用户设置密码。将它们构建为一个流程使认证代码减半并保证一致的行为。

**好**
```
1. 用户提交: { email, name, [应用特定字段] }
2. 服务器创建账户（未设置密码，状态: pending_verification）
3. 服务器发送邮件: "欢迎！设置您的密码: [带令牌的链接]"
4. 用户点击链接 → 设置密码页面
5. 用户设置密码 → 账户激活 → 已登录
6. 如果链接过期 → 用户点击"重新发送" → 相同流程
```

---

## 2. 提供者抽象

```
强制:
  ├── 在 AuthService 接口后面封装认证提供者
  ├── 应用代码绝不直接调用 Cognito/Firebase/Google/Supabase Auth
  ├── AuthService 暴露: signup, login, logout, resetPassword, refreshToken, getCurrentUser
  ├── 切换提供者 = 重写 AuthService 实现，而非整个应用
  └── 认证提供者配置（池 ID、客户端 ID、URL）放在环境变量中 — 不在代码中
```

**好**
```typescript
// auth/AuthService.ts — 接口
interface AuthService {
  signup(email: string, metadata?: Record<string, string>): Promise<{ userId: string }>;
  login(email: string, password: string): Promise<AuthTokens>;
  logout(): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  setPassword(token: string, newPassword: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  getCurrentUser(): Promise<User | null>;
}

// auth/providers/CognitoAuthService.ts — 实现
// auth/providers/FirebaseAuthService.ts — 实现
// auth/providers/SupabaseAuthService.ts — 实现
```

**坏** — 在组件中直接调用提供者：
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
// 分散在 15 个组件中，无法切换提供者
```

---

## 3. Token 管理

```
强制:
  ├── 访问令牌: 短有效期（15-60 分钟）
  ├── 刷新令牌: 较长有效期（7-30 天），用于获取新访问令牌
  ├── Web: 将令牌存储在 httpOnly、secure、sameSite cookies 中 — 绝不用 localStorage
  ├── 移动端 (React Native/Flutter): 使用平台安全存储（Keychain/Keystore）
  ├── 自动刷新: 拦截 401 响应，刷新令牌，重试请求
  ├── 绝不在 JavaScript 可访问的存储中存储令牌（localStorage, sessionStorage）
  └── 绝不在 URL 查询参数中发送令牌
```

**好** — 自动刷新拦截器:
```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newTokens = await authService.refreshToken(getRefreshToken());
      setTokens(newTokens);
      error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 4. 密码策略

```
强制:
  ├── 最少 8 个字符 — 没有上限（允许最多 128 个）
  ├── 要求混合: 大写、小写、数字、特殊字符
  ├── 对照通用密码列表检查（前 10,000）— 拒绝 "Password123!"
  ├── 用户输入时实时显示密码强度指示器
  ├── 允许在密码字段中粘贴 — 绝不禁用粘贴
  ├── 绝不明文存储密码 — 哈希仅在服务端（bcrypt/argon2）
  ├── 绝不超过 UI 提示将密码要求传递给客户端
  └── 限制登录尝试: 5 次失败后锁定 15 分钟
```

---

## 5. 会话管理

```
强制:
  ├── 登出清除所有状态: 令牌、缓存用户数据、内存状态
  ├── 登出在服务端使刷新令牌失效（不只是客户端删除）
  ├── 会话超时: 不活动期后自动登出（每个应用可配置）
  ├── 多标签页同步 (web): 一个标签页登出 = 所有标签页登出
  ├── Token 过期: 显示"会话过期"消息，重定向到登录
  ├── 绝不保留过期的认证状态 — 如果令牌刷新失败，强制登出
  └── 应用启动时: 在显示认证 UI 之前验证存储的令牌
```

**好** — 多标签页登出同步:
```typescript
// 监听存储事件（当另一个标签页更改存储时触发）
window.addEventListener('storage', (event) => {
  if (event.key === 'logout-event') {
    authService.clearLocalState();
    window.location.href = '/login';
  }
});

// 登出时，向其他标签页广播
function logout() {
  localStorage.setItem('logout-event', Date.now().toString());
  localStorage.removeItem('logout-event');
  authService.logout();
}
```

---

## 6. 社交认证 / OAuth

```
当支持社交登录时:
  ├── 使用 OAuth 2.0 / OpenID Connect — 绝不用自定义社交认证流程
  ├── 处理"邮箱已存在" — 提供关联账户，不要创建重复
  ├── 将提供者 + 提供者用户 ID 与本地账户一起存储
  ├── 社交登录在首次使用时创建本地账户（与邮箱注册相同，但预验证）
  ├── 允许用户稍后设置密码（以便与社交同时使用邮箱+密码登录）
  ├── 绝不信任 OAuth 提供者的邮箱，而不验证它是同一个用户
  └── 为公共客户端（SPAs、移动应用）实现 PKCE
```

**账户关联流程:**
```
1. 用户点击"使用 Google 登录" → OAuth 流程 → 返回 email: jane@example.com
2. 服务器检查: jane@example.com 是否已有账户？
   是 → 将 Google 提供者关联到现有账户 → 登录
   否  → 以 Google 为主提供者创建新账户 → 登录
3. 用户可以稍后设置密码以同时使用邮箱+密码登录
```

---

## 7. 邮箱验证

```
强制:
  ├── 账户完全激活前必须验证邮箱
  ├── 验证链接 = 一次性令牌，24 小时过期
  ├── 未验证账户: 允许登录但限制访问（显示"验证您的邮箱"横幅）
  ├── 重新发送验证: 限制为每小时 3 次
  ├── 邮箱更改后: 在切换之前重新验证新邮箱
  └── 绝不暴露邮箱是否已注册（防止枚举）
```

**反枚举模式:**
```
// 坏 — 泄露邮箱是否存在
"找不到 jane@example.com 的账户"

// 好 — 无论邮箱是否存在都使用相同消息
"如果此邮箱有账户，您将收到密码重置链接"
```

---

## 8. 多因素认证（MFA）

```
当需要 MFA 时:
  ├── 主要支持 TOTP（认证器应用）— SMS 仅作为后备
  ├── 在 MFA 设置期间提供恢复码（8-10 个一次性代码）
  ├── 恢复码哈希存储 — 仅在设置期间显示一次
  ├── MFA 注册: 默认可选，管理员/提升角色强制
  ├── 记住设备: 提供"信任此设备 30 天"选项
  └── 绝不用邮箱作为第二因素 — 它与密码重置是同一通道
```

---

## 9. 授权模式

```
强制:
  ├── 基于角色的访问控制（RBAC）: 用显式权限定义角色
  ├── 在每个请求上 **服务端** 检查权限 — 客户端检查只是 UI 提示
  ├── 将角色定义为枚举: ADMIN, MEMBER, VIEWER — 不是字符串
  ├── 权限检查: can(user, action, resource) — 不是角色字符串比较
  ├── UI: 隐藏或禁用用户无法执行的操作 — 不要显示然后拒绝
  ├── API: 对未授权操作返回 403 Forbidden — 不是 404
  └── 绝不从用户属性派生权限 — 使用显式的角色 → 权限映射
```

**好**
```typescript
// 显式定义权限
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: ['users:read', 'users:write', 'users:delete', 'settings:write'],
  [UserRole.MEMBER]: ['users:read', 'users:write'],
  [UserRole.VIEWER]: ['users:read'],
};

function can(user: User, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

// 在 API 处理程序中
if (!can(currentUser, 'users:delete')) {
  throw new ForbiddenError('权限不足');
}
```

---

## 10. 认证相关安全

```
强制:
  ├── 所有认证端点使用 HTTPS — 没有例外
  ├── 认证表单上的 CSRF 保护（使用框架内置的 CSRF 令牌）
  ├── 暴力破解保护: 限制登录，N 次失败后锁定
  ├── 密码重置令牌: 一次性、时间限制、加密随机
  ├── 记录所有认证事件: 登录、登出、失败尝试、密码更改、MFA 事件
  ├── 绝不记录密码、令牌或会话 ID — 即使在错误日志中
  ├── 绝不在 URL 中包含认证令牌 — 使用 headers 或 cookies
  └── 定期轮换签名密钥（JWT 密钥、cookie 签名密钥）
```

---

## 11. 认证 UI 模式

```
强制:
  ├── 登录表单: 邮箱 + 密码 + "忘记密码？"链接 + 社交登录按钮
  ├── 注册表单: 邮箱 + 应用特定字段 + "已有账户？"链接
  ├── 忘记密码: 邮箱输入 → "检查您的邮箱"（无论邮箱是否存在都使用相同消息）
  ├── 设置密码: 新密码 + 确认密码 + 强度指示器
  ├── 所有认证按钮上的加载状态 — 提交期间禁用
  ├── 密码字段上的显示/隐藏密码切换
  ├── 验证错误时保留表单数据 — 不要清除表单
  └── 登录后重定向到预期目的地（不总是到主页）
```

**登录后重定向:**
```typescript
// 重定向到登录之前，存储预期的 URL
const returnUrl = window.location.pathname;
router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);

// 登录成功后
const returnUrl = searchParams.get('returnUrl') || '/dashboard';
router.push(returnUrl);
```

---

## 12. 反模式

```
绝不要:
  ├── 注册时使用密码 — 使用先邮箱后设置密码的流程
  ├── 在 localStorage 中存储令牌 — 使用 httpOnly cookies（web）或安全存储（移动端）
  ├── 在 URL 查询参数中包含令牌
  ├── 从组件中直接调用认证提供者 — 使用 AuthService 抽象
  ├── 泄露邮箱是否已注册（"找不到...的账户"）
  ├── 仅客户端权限检查 — 始终在服务端执行
  ├── 登录失败类型使用相同消息（"密码错误" vs "账户锁定"）
  ├── 在密码字段上禁用粘贴
  ├── 将邮箱用作 MFA 的第二因素
  ├── 存储明文密码或未哈希的恢复码
  └── 静默令牌过期 — 始终通知用户并重定向到登录
```

---

## 认证验证清单

- [ ] 注册是先邮箱的 — 注册时没有密码
- [ ] 设置密码和忘记密码共享相同的基于令牌的流程
- [ ] 认证提供者封装在 AuthService 接口中 — 没有直接提供者调用
- [ ] 令牌存储在 httpOnly cookies（web）或安全存储（移动端）中
- [ ] 访问令牌短有效期，在 401 时自动刷新
- [ ] 登出清除所有状态并在服务端使刷新令牌失效
- [ ] 多标签页登出同步（web）
- [ ] 密码策略执行，带强度指示器
- [ ] 登录限制 — 5 次失败后锁定
- [ ] 邮箱枚举防止（已存在/不存在邮箱使用相同响应）
- [ ] 社交认证处理现有邮箱的账户关联
- [ ] 每个请求在服务端检查权限
- [ ] 角色定义为带显式权限映射的枚举
- [ ] 所有认证事件已记录（日志中没有令牌/密码）
- [ ] 登录后重定向到预期目的地
