# TypeScript 规范

这些规则是**强制性的**。违反即任务失败。无例外。

---

## 1. 严格模式

`tsconfig.json` 必须有 `"strict": true`。绝不开 strict 标志来压制错误 — 修代码。

```
强制:
  ├── tsconfig.json 中 "strict": true
  ├── 绝不用 any — 用 unknown 处理真正未知的类型，然后收窄
  ├── 绝不用 object 类型 — 用具体 interface 或 Record<K, V>
  └── 函数参数和返回值必须都有类型 (不允许隐式 any)
```

```ts
// 禁止
function process(data: any) { return data.value; }

// 正确 — unknown 强制在使用前收窄
function process(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as { value: unknown }).value);
  }
  throw new Error('Unexpected data shape');
}
```

---

## 2. Interface vs Type

```
用 INTERFACE: 对象形状、可扩展契约、类实现
用 TYPE:     联合类型、交叉类型、工具类型、映射/条件类型
```

```ts
// 正确
interface User { id: string; name: string; email: string; }
interface AdminUser extends User { permissions: string[]; }
type UserRole = 'admin' | 'editor' | 'viewer';
type UserSummary = Pick<User, 'id' | 'name'>;
```

---

## 3. 泛型组件

```ts
// 正确 — 可复用泛型表格避免逐类型重复
interface DataTableProps<T> {
  data: T[];
  columns: Array<{ key: keyof T; label: string }>;
  onRowClick: (row: T) => void;
}
function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) { /* ... */ }
```

---

## 4. Zod 模式驱动验证

Zod 模式是运行时验证 AND TypeScript 类型的唯一事实来源。已有 Zod 模式定义形状时，绝不要单独定义 type。

```ts
import { z } from 'zod';

// 正确 — 模式驱动验证和类型
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
});
type User = z.infer<typeof UserSchema>;  // 派生 — 绝不重复

// 禁止 — 单独 type 会随模式逐渐偏离
type User = { id: string; email: string; role: string };
```

Zod 用于: 表单验证、API 响应解析、环境变量验证、配置文件。

---

## 5. 错误类型

```ts
// 禁止
try { /* ... */ } catch (e: any) { console.log(e.message); }

// 正确 — 使用前收窄 unknown
try { /* ... */ } catch (error: unknown) {
  if (error instanceof Error) console.error(error.message);
  else console.error('Unknown error', error);
}
```

---

## 6. 固定选项集用枚举

```ts
// 正确 — 简单状态标记用联合类型
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

// 正确 — 需要迭代或键映射时用 enum
enum Direction { Up = 'UP', Down = 'DOWN', Left = 'LEFT', Right = 'RIGHT' }

// 禁止 — 魔法字符串散落在代码库 (拼写错误永远不会被捕获)
if (status === 'pndng') { /* ... */ }
```

---

## 7. 导入顺序

```ts
// 1. React / 框架
import React, { useState } from 'react';
// 2. 第三方库
import { z } from 'zod';
// 3. 共享/内部别名
import { Button } from '@/components/ui/Button';
// 4. 本地/相对导入
import { formatDate } from './utils';
import type { UserFilters } from './types';
```

---

## 8. 命名约定

| 项目                  | 约定                  | 示例                  |
|-----------------------|-----------------------|----------------------|
| React 组件            | PascalCase            | `UserList.tsx`       |
| Hooks                 | camelCase + `use`     | `useAuth.ts`         |
| 服务                  | camelCase + `Service` | `userService.ts`     |
| 类型 / 接口           | PascalCase            | `User`, `UserFilters`|
| 常量                  | UPPER_SNAKE_CASE      | `API_BASE_URL`       |
| 非组件文件            | camelCase             | `helpers.ts`         |
| 文件夹                | kebab-case            | `user-profile/`      |
| CSS 类名              | kebab-case            | `.user-card`         |
| 布尔 props/状态       | `is`/`has`/`can` 前缀 | `isLoading`          |
| 事件处理函数          | `handle` 前缀         | `handleSubmit`       |
| 回调 props            | `on` 前缀             | `onSuccess`          |

```ts
// 正确
const isLoading = true;
function handleSubmit(e: React.FormEvent) { /* ... */ }
<Form onSubmit={handleSubmit} />

// 禁止
const loading = true;
function submitForm() { /* ... */ }
<Form submitHandler={submitForm} />
```

---

## 提交前 TypeScript 检查清单

- [ ] `tsconfig.json` 中有 `"strict": true`
- [ ] 无 `any` — 用 `unknown` + 收窄代替
- [ ] 无裸 `object` 类型 — 仅具体接口或 `Record<K,V>`
- [ ] 对象形状用 interface; 联合/工具类型用 type
- [ ] Zod 模式通过 `z.infer` 驱动验证和类型
- [ ] 捕获的错误在使用前收窄 (`instanceof Error` 检查)
- [ ] 所有固定选项集用枚举或联合类型 — 无魔法字符串
- [ ] 导入顺序: React → 第三方 → 共享 → 本地
- [ ] 布尔 props/状态用 `is`/`has`/`can` 前缀
- [ ] 事件处理用 `handle` 前缀; 回调 props 用 `on` 前缀
- [ ] 所有文件、组件、hooks 和服务遵循命名约定
