# Tailwind CSS 规范

这些规则是**强制性的**。违反即任务失败。无例外。

---

## 1. 仅使用 Class 样式

```
强制:
  ├── 仅使用 Tailwind 工具类 — 禁止行内样式、CSS 模块、styled-components
  ├── 例外: CSS 变量用于主题标记 (例如: bg-[var(--brand-primary)])
  ├── 例外: 需要 @keyframes 的动画 — 在 tailwind.config 或 globals.css 中定义
  └── 绝不在同一项目中混用 Tailwind 和其他 CSS 方案
```

**禁止** — `<div style={{ padding: '16px', color: 'red' }}>`

**正确** — `<div className="p-4 text-red-500">`

---

## 2. 响应式设计 — 移动优先

```
强制:
  ├── 默认样式面向移动端 — 大屏加断点
  ├── 断点顺序: base → sm: → md: → lg: → xl: → 2xl:
  ├── 绝不用 max-width 断点 — 始终用 min-width (Tailwind 默认)
  └── 在每个断点测试 — 不要假设中间尺寸自动生效
```

**禁止** — 桌面优先: `<div className="flex lg:flex max-lg:block">`

**正确** — 移动优先: `<div className="block md:flex">`

---

## 3. 组件提取优于 @apply

```
强制:
  ├── 将重复的工具类模式提取为组件 — 不要用 @apply
  ├── @apply 仅允许用于全局基础样式 (body, headings, links)
  ├── 使用 cn() 辅助函数处理条件类
  └── 绝不要创建 .btn, .card 等工具类 — 应提取为组件
```

**禁止** — CSS 中的 @apply:
```css
.btn-primary { @apply px-4 py-2 bg-blue-500 text-white rounded; }
```

**正确** — React 组件:
```tsx
function Button({ children, variant = 'primary', className }: ButtonProps) {
  return (
    <button className={cn(
      'px-4 py-2 rounded font-medium transition-colors',
      variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
      variant === 'ghost' && 'bg-transparent hover:bg-gray-100',
      className
    )}>
      {children}
    </button>
  );
}
```

---

## 4. cn() 辅助函数

```
强制:
  ├── 使用 cn() 或 clsx() 处理条件和合并类名
  ├── Tailwind 冲突用 tailwind-merge (twMerge) 解决
  └── 标准模式: cn = (...classes) => twMerge(clsx(...classes))
```

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 5. 颜色和主题系统

```
强制:
  ├── 颜色定义为 CSS 变量 — 不要硬编码 Tailwind 颜色
  ├── 用语义名称 (--color-primary, --color-surface) — 不用视觉名称 (--blue-500)
  ├── 通过 CSS 变量或 Tailwind dark: 前缀支持暗色模式
  ├── 绝不用任意颜色值 ([#ff6b35]) — 添加到主题配置
  └── 透明度用 Tailwind (text-primary/80) — 不用 rgba
```

**正确** — `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: 'var(--color-primary)',
      surface: 'var(--color-surface)',
      border: 'var(--color-border)',
    },
  },
}
```

---

## 6. 间距和布局

```
强制:
  ├── 使用 Tailwind 间距刻度 (p-4, gap-3, m-2) — 不用任意值
  ├── 用 Flexbox (flex) 或 Grid (grid) 布局 — 不用 floats 或绝对定位
  ├── flex/grid 子元素用 gap-* 间距 — 不在子元素上用 margin
  ├── 间距一致: 选一个刻度 (4px base) 并坚持
  └── 仅当精确匹配设计规范时用任意值 ([17px])
```

---

## 7. 暗色模式

```
支持暗色模式时:
  ├── 用 class 策略 (darkMode: 'class') 支持用户切换
  ├── dark: 变体与基础样式并列 — 不要分文件
  ├── 两种模式都要测试 — 暗色不是简单"反转颜色"
  └── 确保两种模式对比度足够 (WCAG AA: 文本 4.5:1)
```

**正确** — `<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">`

---

## 8. 反模式

```
绝不做:
  ├── 行内样式与 Tailwind 类并存
  ├── 组件级样式用 @apply — 提取为组件
  ├── 有 Tailwind 刻度值时用任意值 (p-[16px] → p-4)
  ├── 用 ! 前缀加 !important — 修复优先级
  ├── 类名过长 (15+ 工具类) — 提取为组件
  ├── 硬编码颜色 ([#hex]) — 加到主题配置
  └── flex/grid 子元素用 margin 间距 — 在父元素上用 gap-*
```

---

## Tailwind 验证清单

- [ ] 无行内样式 — 仅 Tailwind 类
- [ ] 移动优先响应式 (base → sm → md → lg)
- [ ] 重复模式提取为组件 — 不用 @apply
- [ ] 条件类使用 cn() 辅助函数
- [ ] 颜色用 CSS 变量/主题配置 — 无硬编码 hex
- [ ] 间距用 Tailwind 刻度 — 最少任意值
- [ ] 暗色模式已测试 (如适用)
- [ ] 类名不超过 ~15 个工具类 — 已提取组件
