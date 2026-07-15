# Playwright 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. 仅功能测试 — 无布局测试

```
强制:
  ├── 每个断言必须验证 **行为** — 不是元素存在性
  ├── 在具有匹配 ID 的空 HTML 页面上通过的测试 **不是** 测试
  ├── 每次用户操作后，断言 **结果**（数据变更、内容加载、状态更新）
  ├── 绝不只断言 isVisible, toBeAttached, toBeEnabled 而没有行为后续
  └── 如果测试在点击/提交/导航后没有断言，它是不完整的
```

**坏** — 布局测试（即使所有内容损坏也会通过）:
```typescript
test('user list page', async ({ page }) => {
  await page.goto('/users');
  await expect(page.locator('#user-table')).toBeVisible();
  await expect(page.locator('.user-row')).toHaveCount(5);
});
```

**好** — 功能测试（功能损坏时失败）:
```typescript
test('user list loads and displays real user data', async ({ page }) => {
  await page.goto('/users');
  await expect(page.locator('.user-row').first()).toContainText('jane@example.com');
  await expect(page.locator('[data-testid="user-count"]')).toHaveText('5 users');
});
```

---

## 2. 测试覆盖深度 — 排列和组合

```
强制 — 每个功能必须跨这些维度测试:

  ├── 正常路径: 标准成功流程端到端
  ├── 验证: 每个表单字段使用无效、空、边界和有效输入
  ├── 错误状态: 网络失败、服务器错误（500）、未找到（404）、超时
  ├── 空状态: 无数据、空列表、零记录的首次用户
  ├── 边缘情况: 边界值、特殊字符、最大长度输入、Unicode
  ├── 权限: 未授权访问、基于角色的可见性、禁用操作
  ├── 状态转换: 记录可以处于的每个状态以及它们之间的转换
  └── 并发: 加载时的操作、重复提交、快速导航
```

### 覆盖矩阵 — 每个功能构建一个

对于任何有 N 个输入或状态的功能，构建覆盖矩阵:

**示例: 用户创建表单（3 个字段，2 个角色，邀请开关）**

| 测试 | 名称 | 邮箱 | 角色 | 邀请 | 预期 |
|------|------|-------|------|--------|----------|
| 正常路径 | "Jane" | jane@x.com | Admin | on | 已创建 + 邀请已发送 |
| 正常路径（无邀请） | "Jane" | jane@x.com | Viewer | off | 已创建，无邀请 |
| 空名称 | "" | jane@x.com | Admin | on | 名称验证错误 |
| 空邮箱 | "Jane" | "" | Admin | on | 邮箱验证错误 |
| 无效邮箱 | "Jane" | "notanemail" | Admin | on | 邮箱验证错误 |
| 重复邮箱 | "Jane" | existing@x.com | Admin | on | 显示 409 冲突错误 |
| 名称最大长度 | "A"×100 | jane@x.com | Admin | on | 已创建（边界） |
| 名称超最大 | "A"×101 | jane@x.com | Admin | on | 验证错误 |
| 名称特殊字符 | "O'Brien-José" | jane@x.com | Admin | on | 已创建（Unicode 安全） |
| 名称 XSS | `<script>` | jane@x.com | Admin | on | 已清理，无执行 |
| 每个角色选项 | "Jane" | jane@x.com | {每个角色} | on | 分配了正确的角色 |
| 服务器错误 | "Jane" | jane@x.com | Admin | on | 错误消息，表单保留 |
| 网络离线 | "Jane" | jane@x.com | Admin | on | 离线指示器，重试选项 |
| 重复提交 | "Jane" | jane@x.com | Admin | on | 仅创建一个用户 |
| 未授权用户 | — | — | — | — | 重定向或显示 403 |

```
每个功能的最低覆盖:
  ├── 每个产生不同结果的有效组合有 1 个正常路径
  ├── 每个字段的每个验证规则有 1 个验证测试
  ├── 每种错误类型有 1 个测试（400, 401, 403, 404, 409, 500, 网络）
  ├── 1 个空状态测试
  ├── 每个带限制的字段有 1 个边界测试（最小、最大、精确边界）
  ├── 影响可见性或访问的每个角色/权限有 1 个测试
  ├── 功能状态机中的每个状态转换有 1 个测试
  └── 每个表单提交有 1 个并发/竞态条件测试
```

---

## 3. 状态转换测试

对于有多个状态的功能（订单、订阅、工单等），测试 **每个** 有效转换:

```
强制:
  ├── 映射状态机: 识别所有状态和有效转换
  ├── 测试每个转换: 操作 + 断言新状态正确
  ├── 测试无效转换: 验证它们被拒绝或不可用
  └── 测试完整生命周期: 创建 → 中间状态 → 终态
```

**示例: 订单生命周期**
```typescript
test.describe('Order state transitions', () => {
  test('new order starts as pending', async ({ page }) => {
    await createOrder(page, testData.validOrder);
    await expect(page.locator('[data-testid="order-status"]')).toHaveText('Pending');
  });

  test('pending → confirmed on payment', async ({ page }) => {
    const order = await createPendingOrder(page);
    await page.click('[data-testid="confirm-payment"]');
    await expect(page.locator('[data-testid="order-status"]')).toHaveText('Confirmed');
  });

  test('confirmed → shipped on dispatch', async ({ page }) => {
    const order = await createConfirmedOrder(page);
    await page.click('[data-testid="mark-shipped"]');
    await expect(page.locator('[data-testid="order-status"]')).toHaveText('Shipped');
    await expect(page.locator('[data-testid="tracking-number"]')).not.toBeEmpty();
  });

  test('pending → cancelled is allowed', async ({ page }) => {
    const order = await createPendingOrder(page);
    await page.click('[data-testid="cancel-order"]');
    await expect(page.locator('[data-testid="order-status"]')).toHaveText('Cancelled');
  });

  test('shipped → cancelled is NOT allowed', async ({ page }) => {
    const order = await createShippedOrder(page);
    await expect(page.locator('[data-testid="cancel-order"]')).toBeDisabled();
  });
});
```

---

## 4. 选择器 — 有弹性和可维护

```
强制:
  ├── 优先使用面向用户的选择器: getByRole, getByLabel, getByText, getByPlaceholder
  ├── 没有可访问角色或可见文本的元素使用 data-testid
  ├── 绝不用 CSS 类选择器 (.btn-primary) — 在样式更改时断裂
  ├── 绝不用 DOM 结构选择器 (div > span:nth-child(2)) — 在布局更改时断裂
  ├── 绝不用自动生成的 ID 或动态类名
  └── 结合选择器提高精度: page.getByRole('button', { name: 'Submit' })
```

**坏**
```typescript
await page.click('.btn.btn-primary.submit-form');
await page.locator('div.user-list > div:nth-child(3) > span').click();
```

**好**
```typescript
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email').fill('jane@example.com');
await page.locator('[data-testid="user-row-jane"]').click();
```

---

## 5. 等待和断言

```
强制:
  ├── 使用 Playwright 自动等待 — 绝不添加手动 sleep/setTimeout
  ├── 对数据依赖的测试断言网络完成: page.waitForResponse
  ├── 使用 toHaveText, toContainText 进行内容验证 — 不只是 toBeVisible
  ├── 使用 web-first 断言（带自动重试的 expect）— 不用 page.evaluate 检查
  ├── 对慢操作设置断言超时: expect(...).toHaveText('...', { timeout: 10000 })
  └── 更改页面的点击后等待导航: page.waitForURL
```

**坏**
```typescript
await page.click('#submit');
await page.waitForTimeout(3000);  // 任意睡眠!
const text = await page.locator('#result').innerText();
expect(text).toBe('Success');  // 不自动重试
```

**好**
```typescript
await page.click('#submit');
await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 201);
await expect(page.locator('[data-testid="result"]')).toHaveText('User created successfully');
```

---

## 6. 页面对象模型

```
10 个以上测试的项目强制:
  ├── 每个页面或主要组件一个页面对象
  ├── 页面对象封装选择器和操作 — 测试读起来像用户故事
  ├── 方法返回数据或其他页面对象（用于导航）
  ├── 绝不在页面对象中放置断言 — 断言属于测试
  └── 页面对象位于 tests/pages/ 或 tests/pom/ 目录
```

**好**
```typescript
// tests/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  emailError() {
    return this.page.locator('[data-testid="email-error"]');
  }

  passwordError() {
    return this.page.locator('[data-testid="password-error"]');
  }
}

// tests/login.spec.ts
test('successful login redirects to dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('jane@example.com', 'validpassword');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome, Jane')).toBeVisible();
});

test('invalid email shows validation error', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('notanemail', 'password');
  await expect(loginPage.emailError()).toHaveText('Enter a valid email address');
});
```

---

## 7. API Mocking 和网络控制

```
隔离、确定性测试强制:
  ├── 使用 page.route() mock API 响应 — 控制 UI 接收的内容
  ├── Mock 错误响应以测试错误处理: route.fulfill({ status: 500 })
  ├── Mock 空响应以测试空状态
  ├── Mock 慢响应以测试加载状态: route.fulfill with delay
  ├── 使用 page.waitForResponse 验证应用发出了预期的 API 调用
  └── 对真实 API 的集成测试: 使用测试/种子数据库，不用 mocks
```

**好**
```typescript
test('shows error message on server failure', async ({ page }) => {
  await page.route('**/api/users', route =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal error' }) })
  );
  await page.goto('/users');
  await expect(page.getByText('Failed to load users')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('shows empty state when no users exist', async ({ page }) => {
  await page.route('**/api/users', route =>
    route.fulfill({ status: 200, body: JSON.stringify({ data: [], meta: { total: 0 } }) })
  );
  await page.goto('/users');
  await expect(page.getByText('No users found')).toBeVisible();
});

test('shows loading skeleton while fetching', async ({ page }) => {
  await page.route('**/api/users', async route => {
    await new Promise(r => setTimeout(r, 2000));
    await route.fulfill({ status: 200, body: JSON.stringify({ data: testUsers }) });
  });
  await page.goto('/users');
  await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
  await expect(page.locator('.user-row').first()).toContainText('jane@example.com');
});
```

---

## 8. 测试组织

```
强制:
  ├── 每个功能或页面一个规范文件: login.spec.ts, user-management.spec.ts
  ├── 用 test.describe 分组相关测试
  ├── 使用 test.beforeEach 进行通用设置（导航、认证、种子数据）
  ├── 使用 test fixtures 获取可复用的认证状态
  ├── 为选择性运行标记测试: test('...', { tag: '@smoke' }, ...)
  └── 保持单个测试独立 — 没有测试应依赖另一个的状态
```

**好**
```typescript
test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/users');
  });

  test.describe('List View', () => {
    test('displays paginated user list', ...);
    test('filters by role', ...);
    test('searches by name or email', ...);
    test('shows empty state when filter matches nothing', ...);
  });

  test.describe('Create User', () => {
    test('creates user with valid data', ...);
    test('shows validation errors for each invalid field', ...);
    test('handles duplicate email conflict', ...);
    test('handles server error gracefully', ...);
    test('prevents double submission', ...);
  });

  test.describe('Edit User', () => {
    test('pre-fills form with existing data', ...);
    test('saves changes and shows confirmation', ...);
    test('handles concurrent edit conflict', ...);
  });

  test.describe('Delete User', () => {
    test('confirms before deleting', ...);
    test('shows success after deletion', ...);
    test('handles deletion of already-deleted user', ...);
  });
});
```

---

## 9. 测试数据管理

```
强制:
  ├── 使用 factories 或 fixtures 生成测试数据 — 绝不在测试体中硬编码
  ├── 每个测试创建自己的数据 — 测试之间没有共享可变状态
  ├── 使用真实数据（不是 "test123"）— 捕获编码、截断、显示问题
  ├── 在 fixtures 中包含边缘情况数据: Unicode、长字符串、特殊字符、空字符串
  ├── 每个测试后清理测试数据（或使用隔离的测试数据库）
  └── 将可复用的测试数据存储在 tests/fixtures/ 目录
```

**好**
```typescript
// tests/fixtures/users.ts
export const testUsers = {
  standard: { name: 'Jane Doe', email: 'jane@example.com', role: 'member' },
  admin: { name: 'Admin User', email: 'admin@example.com', role: 'admin' },
  unicode: { name: "José O'Brien-García", email: 'jose@example.com', role: 'member' },
  longName: { name: 'A'.repeat(100), email: 'long@example.com', role: 'member' },
  specialChars: { name: 'Test <script>alert(1)</script>', email: 'xss@example.com', role: 'member' },
};
```

---

## 10. 组合测试策略

对于有多个交互输入的功能，使用 pairwise/组合覆盖:

```
3 个以上独立输入的表单强制:
  ├── 识别所有输入及其有效值
  ├── 独立测试所有单字段验证
  ├── 多字段交互使用 pairwise 组合（不是完整的笛卡尔积）
  ├── 始终测试极端情况: 全空、全最大、全无效
  └── 为已知业务规则添加特定组合
```

**示例: 带 3 个过滤器的搜索（状态、角色、日期范围）**

不测试所有 4×3×5 = 60 种组合，使用 pairwise:

```typescript
const filterCombinations = [
  // Pairwise 用更少的测试覆盖所有两两交互
  { status: 'active', role: 'admin', dateRange: 'last7days' },
  { status: 'active', role: 'viewer', dateRange: 'last30days' },
  { status: 'active', role: 'member', dateRange: 'allTime' },
  { status: 'inactive', role: 'admin', dateRange: 'last30days' },
  { status: 'inactive', role: 'viewer', dateRange: 'allTime' },
  { status: 'inactive', role: 'member', dateRange: 'last7days' },
  { status: 'all', role: 'admin', dateRange: 'allTime' },
  { status: 'all', role: 'viewer', dateRange: 'last7days' },
  { status: 'all', role: 'member', dateRange: 'last30days' },
  // 极端情况
  { status: 'all', role: undefined, dateRange: undefined },  // 无过滤器
];

for (const combo of filterCombinations) {
  test(`filters: status=${combo.status}, role=${combo.role}, date=${combo.dateRange}`, async ({ page }) => {
    await applyFilters(page, combo);
    const results = await getVisibleResults(page);
    // 断言每个结果匹配所有活动过滤器
    for (const result of results) {
      if (combo.status !== 'all') expect(result.status).toBe(combo.status);
      if (combo.role) expect(result.role).toBe(combo.role);
      if (combo.dateRange) expect(isInDateRange(result.date, combo.dateRange)).toBe(true);
    }
  });
}
```

---

## 11. 多步骤工作流测试

```
多页或多步骤功能强制:
  ├── 测试完整端到端流程: 开始 → 每步 → 完成 → 验证
  ├── 测试向后导航: 第 3 步 → 第 2 步 → 第 3 步（数据保留？）
  ├── 测试放弃: 开始流程 → 导航离开 → 返回（状态保留或重置？）
  ├── 独立测试每步的验证
  ├── 测试带预填充数据的流程（编辑模式 vs 创建模式）
  └── 通过回读验证最终结果（不只是检查成功消息）
```

**好**
```typescript
test('complete checkout flow end-to-end', async ({ page }) => {
  // 步骤 1: 添加到购物车
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add Widget to cart' }).click();
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

  // 步骤 2: 购物车审查
  await page.goto('/cart');
  await expect(page.getByText('Widget')).toBeVisible();
  await page.getByRole('button', { name: 'Checkout' }).click();

  // 步骤 3: 配送
  await page.getByLabel('Address').fill('123 Main St');
  await page.getByLabel('City').fill('Springfield');
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  // 步骤 4: 支付
  await page.getByLabel('Card number').fill('4242424242424242');
  await page.getByRole('button', { name: 'Place order' }).click();

  // 验证: 检查确认 AND 回读订单
  await expect(page).toHaveURL(/\/orders\/[a-z0-9-]+/);
  await expect(page.getByText('Order confirmed')).toBeVisible();
  await expect(page.getByText('Widget')).toBeVisible();
  await expect(page.getByText('123 Main St')).toBeVisible();
});

test('checkout preserves data on backward navigation', async ({ page }) => {
  // 填写配送，去支付，返回配送
  // 断言: 配送字段仍然填充
});
```

---

## 12. 跨浏览器和响应式测试

```
推荐:
  ├── 在 playwright.config 中配置 chromium, firefox, webkit 项目
  ├── 添加移动视口项目进行响应式测试
  ├── 在 CI 中运行跨浏览器 — chromium-only 对本地开发可接受
  ├── 在移动视口上测试触摸交互（tap, swipe）
  └── 验证响应式断点: mobile (375px), tablet (768px), desktop (1280px)
```

**好** — playwright.config.ts:
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
],
```

---

## 13. 反模式

```
绝不要:
  ├── 仅布局断言（isVisible, toBeAttached 没有行为后续）
  ├── waitForTimeout / 手动睡眠 — 使用自动等待和 waitForResponse
  ├── CSS 类选择器 (.btn-primary) — 使用 role, label, testid
  ├── DOM 结构选择器 (div > span:nth-child) — 任何布局更改都会断裂
  ├── 依赖其他测试状态的测试 — 每个测试独立
  ├── 页面对象中的断言 — 页面对象封装操作，测试断言
  ├── 测试体中的硬编码测试数据 — 使用 fixtures
  ├── 跳过错误/空/加载状态测试 — 它们捕获真实 bug
  ├── 只测试正常路径 — 大多数 bug 在边缘情况中
  ├── pairwise 足够时用完整笛卡尔积 — 浪费 CI 时间
  └── 用 console.log 调试 — 使用 Playwright trace viewer 和截图
```

---

## Playwright 验证清单

- [ ] 每个断言验证行为 — 不只是元素存在性
- [ ] 每个功能构建了覆盖矩阵（正常、验证、错误、空、边缘、权限、状态转换）
- [ ] 所有表单字段已测试: 有效、无效、空、边界、特殊字符
- [ ] 错误状态已测试: 400, 401, 403, 404, 500, 网络失败
- [ ] 空状态已测试: 零记录、无搜索结果
- [ ] 状态转换已测试: 每个有效 + 无效转换
- [ ] 多步骤流程端到端测试，带向后导航
- [ ] 多输入功能使用 pairwise 组合
- [ ] 重复提交 / 并发操作保护已测试
- [ ] 选择器使用 role, label, testid — 无 CSS 类或 DOM 结构
- [ ] 无手动等待 — 仅自动等待和 waitForResponse
- [ ] 10+ 测试时使用页面对象模型
- [ ] 测试数据在 fixtures 中 — 不硬编码
- [ ] 每个测试独立 — 无共享可变状态
- [ ] API 用于错误/空/加载场景的 mock
```
