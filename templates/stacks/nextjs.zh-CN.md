# Next.js 标准

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## 1. App Router（Next.js 13+）

```
强制:
  ├── 使用 App Router（app/）— 新项目不用 Pages Router（pages/）
  ├── 默认使用 Server Components — 仅在需要时添加 'use client'
  ├── 需要 'use client' 的情况: useState, useEffect, 事件处理器、浏览器 API
  ├── 保持 'use client' 边界尽可能低 — 不要标记整个页面
  └── 绝不在客户端组件中导入仅服务端的代码
```

**坏** — 将整个页面标记为客户端:
```tsx
'use client'; // ← 不必要 — 只有按钮需要交互性
export default function Page() {
  return <div><h1>Static content</h1><LikeButton /></div>;
}
```

**好** — 将客户端边界下推:
```tsx
// app/page.tsx — Server Component（默认）
export default function Page() {
  return <div><h1>Static content</h1><LikeButton /></div>;
}

// components/LikeButton.tsx
'use client';
export function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>Like</button>;
}
```

---

## 2. 数据获取

```
强制:
  ├── Server Components: 直接 fetch（async 组件）— 不用 useEffect
  ├── Client Components: 对服务器数据使用 React Query — 同 react.md 第 1 节
  ├── 使用 Route Handlers（app/api/）作为 API 端点 — 不用 pages/api/
  ├── 在服务端获取上设置 revalidate 或 cache 选项
  └── 绝不在 Server Components 中调用自己的 API 路由 — 直接调用函数
```

**坏** — Server Component 调用自己的 API:
```tsx
// app/page.tsx
const res = await fetch('http://localhost:3000/api/users'); // 调用自己!
```

**好** — 直接调用数据函数:
```tsx
// app/page.tsx
import { getUsers } from '@/lib/data/users';
export default async function Page() {
  const users = await getUsers();
  return <UserList users={users} />;
}
```

---

## 3. 路由结构

```
强制:
  ├── app/{route}/page.tsx — 页面组件
  ├── app/{route}/layout.tsx — 共享布局（包装子页面）
  ├── app/{route}/loading.tsx — 路由的 Suspense 后备
  ├── app/{route}/error.tsx — 路由的错误边界（'use client'）
  ├── app/{route}/not-found.tsx — 路由的 404
  ├── 用（括号）分组路由以进行布局分组: app/(auth)/login
  └── 动态路由: app/users/[id]/page.tsx
```

---

## 4. Server Actions

```
强制（Next.js 14+）:
  ├── 对表单变更使用 Server Actions — 不用客户端 API 调用
  ├── 在函数或文件顶部标记 'use server'
  ├── 用 Zod 验证所有输入 — Server Actions 是公共端点
  ├── 返回类型化结果 — 不是原始响应
  └── 变更后重新验证缓存: revalidatePath() 或 revalidateTag()
```

**好**
```tsx
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const schema = z.object({ name: z.string().min(2), email: z.string().email() });

export async function createUser(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten() };

  await db.user.create({ data: parsed.data });
  revalidatePath('/users');
  return { success: true };
}
```

---

## 5. 环境变量

```
强制:
  ├── NEXT_PUBLIC_ 前缀用于客户端暴露的变量 — 其他都是仅服务端的
  ├── 绝不在 NEXT_PUBLIC_ 变量中放入密钥 — 它们在客户端包中
  ├── 在 Server Components、Route Handlers、Server Actions 中访问仅服务端变量
  ├── 用 t3-env 或手动检查在启动时验证环境变量
  └── .env.local 在 .gitignore 中 — 提交带占位符值的 .env.example
```

---

## 6. 元数据和 SEO

```
强制:
  ├── 从 page.tsx 导出 metadata 对象或 generateMetadata 函数
  ├── 每个页面至少需要 title 和 description
  ├── 使用模板保持一致的标题: { template: '%s | AppName' }
  ├── 为可共享页面设置 Open Graph 和 Twitter card 元数据
  └── 通过 app/robots.ts 和 app/sitemap.ts 添加 robots.txt 和 sitemap.xml
```

---

## 7. 中间件

```
需要时:
  ├── 在项目根目录使用 middleware.ts 进行认证重定向、地理定位、头部设置
  ├── 保持中间件快速 — 它在每个匹配 matcher 的请求上运行
  ├── 使用 matcher 配置限制哪些路由触发中间件
  ├── 绝不在中间件中进行繁重计算或数据库调用
  └── 使用 NextResponse.next() 继续，NextResponse.redirect() 重定向
```

---

## 8. 反模式

```
绝不要:
  ├── 整个页面使用 'use client' 当只有一小部分需要交互性时
  ├── 当 Server Component 可以工作时在组件中使用 useEffect + fetch
  ├── 从 Server Components 获取自己的 API 路由
  ├── Server Actions 没有输入验证 — 它们是公共端点
  ├── NEXT_PUBLIC_ 环境变量中的密钥
  ├── App Router 项目中的 getServerSideProps / getStaticProps（Pages Router）
  ├── 在 'use client' 组件中导入仅服务端模块（fs, db）
  └── 每次导航都重新渲染的庞大布局
```

---

## Next.js 验证清单

- [ ] 使用 App Router（app/ 目录）
- [ ] 默认 Server Components — 'use client' 仅在需要时使用
- [ ] 客户端边界尽可能低推
- [ ] 服务端获取直接调用函数 — 不调用自己的 API 路由
- [ ] Server Actions 用 Zod 验证输入
- [ ] 变更后重新验证缓存
- [ ] 每个页面都有元数据（title + description）
- [ ] 每个主要路由都有 loading.tsx 和 error.tsx
- [ ] NEXT_PUBLIC_ 变量中没有密钥
- [ ] 中间件快速并使用 matcher 配置
