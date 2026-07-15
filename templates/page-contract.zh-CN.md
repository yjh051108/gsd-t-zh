# 页面合同: {页面名称}

组件 + 全局布局 + 路由 + 数据加载的顶层组装。页面在布局网格中**定位**组件；它们不能重新定义组件内部结构或元素视觉规格。

## 元数据

| 字段          | 值                                           |
|----------------|-------------------------------------------------|
| 页面           | {例如，dashboard-overview}                      |
| 路由          | {例如，/dashboard 或 /dashboard/overview}       |
| 版本        | {1.0}                                           |
| 设计来源  | {Figma 页面 URL 或图片引用}             |
| 提取日期 | {YYYY-MM-DD}                                    |

## 用途

{一句话 — 此页面的用途以及谁使用它。例如，"登录后的主要着陆页面。为高管展示 KPI、收入趋势和最近活动，一目了然。"}

## 使用的组件

| 网格中的位置                 | 组件合同                 | 布局备注                 |
|----------------------------------|---------------------------------|------------------------------|
| header                           | page-header-widget              | sticky                       |
| sidebar                          | nav-sidebar-widget              | 在 <1024px 时可折叠       |
| grid[row=1, cols=1-4]            | stat-strip-widget               | 全宽行               |
| grid[row=2, col=1-2]             | revenue-breakdown-widget        | 跨 2 列              |
| grid[row=2, col=3-4]             | user-growth-widget              | 跨 2 列              |
| grid[row=3, col=1-4]             | recent-activity-table-widget    | 全宽                   |

**网格位置格式**: 使用 `grid[row=N, col=M]` / `grid[row=N, cols=M-K]` **或** 命名 CSS 网格区域（`grid-area: strip`）。在同一页面中保持一致。**布局备注**列仅记录定位元数据（跨度、堆叠、sticky/fixed）— **不**记录组件配置（组件属性在组件合同中）。

## 页面夹具（可选）

如果你想形式化组合链（元素 → 组件 → 页面），声明一个引用每个组件夹具的页面级夹具：

```json
{
  "__fixture_source__": "composed-from-widgets",
  "strip":  "$ref:stat-strip-widget#/fixture",
  "donut":  "$ref:revenue-breakdown-widget#/fixture",
  "bar":    "$ref:user-growth-widget#/fixture"
}
```

对于纯组装、没有 storybook / 工具包目标的页面，跳过此部分。当页面有专用演示路由或多个页面共享组件夹具并希望记录每个页面引用哪个实例时包含它。

**多状态页面**（当页面状态切换组件数据时）：声明**每个状态一个完整夹具**，按键名。优先完整复制而非覆盖增量 — 虽然更冗长，但使每个状态可独立运行并避免合并歧义。

```json
{
  "__fixture_source__": "composed-from-widgets",
  "__states__": ["Members", "Sessions"],
  "Members": {
    "donut": "$ref:donut-chart-card-widget#/fixture",
    "bar":   "$ref:bar-chart-card-widget#/fixture"
  },
  "Sessions": {
    "donut": "$ref:donut-chart-card-widget#/fixture-sessions",
    "bar":   "$ref:bar-chart-card-widget#/fixture-sessions"
  }
}
```

具有多个夹具变体的组件合同将其暴露为命名子夹具（`#/fixture-sessions`，`#/fixture-q4` 等），而不是单个 `#/fixture`。

**内联存根提升**: 如果页面级控件或 chrome 元素（区段控制、标签栏、面包屑）在 ≥2 个页面中使用，将其提升为独立的组件合同。在提升之前，在 **直接组合的元素** 中以 `(promotion candidate)` 标签和使用它的页面路径列出存根。

## 布局

```
┌──────────────────────────────────────────────────────┐
│                  page-header-widget                  │
├──────────┬───────────────────────────────────────────┤
│          │  stat-strip-widget                        │
│   nav-   ├─────────────────────┬─────────────────────┤
│  sidebar │  revenue-breakdown  │   user-growth       │
│  -widget │                     │                     │
│          ├─────────────────────┴─────────────────────┤
│          │       recent-activity-table-widget        │
└──────────┴──────────────────────────────────────────┘
```

| 属性            | 值                                          |
|---------------------|------------------------------------------------|
| layout_type         | {grid / flex / fixed-sidebar+fluid-content}    |
| grid_columns        | {4}                                            |
| grid_column_gap     | {tokens.spacing.6}                             |
| grid_row_gap        | {tokens.spacing.6}                             |
| page_padding        | {tokens.spacing.8}                             |
| max_content_width   | {1440px}                                       |
| sidebar_width       | {240px (展开) / 64px (折叠)}          |
| header_height       | {64px}                                         |
| background          | {tokens.color.bg.page}                         |

## 数据加载

**页面级数据需求:**
```typescript
{
  stats: Stat[];
  revenue: RevenueData[];
  userGrowth: GrowthData[];
  activity: ActivityRow[];
}
```

**加载策略:**
- {例如，挂载时单次 API 调用到 `/api/dashboard/overview`}
- {例如，每个组件并行获取；组件管理自己的加载状态}
- {例如，服务端渲染 + 增量水合}

## 路由与导航

- **路由**: {/dashboard/overview}
- **守卫**: {需要认证，角色: user|admin} — 如果守卫已声明但尚未接线，前缀 `(stub)` 并链接将接线它的认证里程碑（例如，`(stub) requires-auth — milestone M4`）。
- **面包屑**: {Home > Dashboard > Overview}
- **导航激活状态**: {在 nav-sidebar 中高亮 "Dashboard"}

## 全局状态

| 状态            | 页面行为                                           |
|------------------|---------------------------------------------------------|
| unauthenticated  | 重定向到 /login                                      |
| page_loading     | 带组件占位符的骨架网格                  |
| page_error       | 带重试按钮的全页错误                       |
| partial_error    | 单个组件显示自己的错误状态；页面保持 |

## 响应式行为

| 断点 | 适应                                                     |
|------------|----------------------------------------------------------------|
| 移动端     | 侧边栏变为抽屉；网格折叠为 1 列；统计垂直堆叠 |
| 平板     | 侧边栏折叠为仅图标；网格变为 2 列         |
| 桌面端    | 完整的规格如上所示                                       |

## 交互

- {侧边栏切换在会话间持久化（localStorage）}
- {组件过滤器更改除非明确接线，否则不影响其他组件}
- {点击 KPI 磁贴导航到详情页面}

## 性能预算

| 指标             | 目标                                          |
|--------------------|-------------------------------------------------|
| 首次内容绘制 | {<1.5s on 4G}                               |
| 可交互时间    | {<3.0s on 4G}                               |
| JS 包大小         | {<200KB gzipped for this route}             |

## 无障碍

- **地标**: `<header>`，`<nav>`，`<main>`，每个组件 `<section role="region">`
- **跳过链接**: 顶部的"跳到主要内容"，激活时聚焦 `<main>`。如果跳过链接以 `<main>` 为目标，`<main>` 必须有 `tabindex="-1"` 才能通过哈希链接导航以编程方式聚焦。
- **键盘顺序**: header → sidebar → 视觉阅读顺序中的组件
- **页面标题**: 通过 `<title>` 按路由设置

## 实现备注

- **组件路径**: {src/pages/DashboardOverview.vue 或 src/routes/dashboard/overview.tsx}
- **组合**: {列出组件导入}
- **路由器集成**: {vue-router / react-router / next.js app dir}
- **数据获取**: {composable / hook / server component}

## 边界规则（必填）

页面被允许：
- 通过组件的文档 `defineProps` / 公共 API 传递**数据**（标题、副标题、夹具数据 — 这些是组件的合法输入）
- 声明页面级布局 CSS（网格模板、间距、内边距、最大宽度、背景、地标区域）
- 管理路由级状态和数据获取

页面**禁止**：
- 声明以组件内部类为目标的 CSS 选择器（`.card-title`、`.donut-segment`、`.legend-dot`） — 这是边界违规
- 通过 `:deep()` 选择器或组件拥有的属性上的 `!important` 覆盖组件视觉规格
- 重新指定元素视觉规格（颜色、字号、圆角、由元素拥有的内边距）

**执行检查**（基于行的纯 CSS grep，避免 JS 标识符上的误报）:
```
grep -En '^\s*(\.card-title|\.donut|\.legend-dot|\.kpi-value|\.chart-wrapper|\.filter-select)[^\w-]*\{' {page-file}
```
前导 `^\s*` 锚点 + 结尾 `\{` 要求仅匹配行首的 CSS 规则，而非 JS 属性访问（`obj.donut`）或变量名（`donutProps`）。如果找到任何匹配，将样式移动到组件合同中或创建组件变体。

## 验证清单

页面级验证在所有组件通过自己的验证后运行。页面验证仅检查组装 — 组件和元素内部不在范围内。

- [ ] 所有组件位于正确的网格位置
- [ ] 布局尺寸（间距、内边距、最大宽度）匹配设计
- [ ] Header / sidebar / main 区域正确标记
- [ ] 侧边栏折叠/展开行为正常
- [ ] 响应式断点按要求重新排列布局
- [ ] 数据加载策略产生正确的组件输入
- [ ] 路由守卫强制执行认证/角色
- [ ] 性能预算达标（用 Lighthouse 测量）
- [ ] 键盘导航遵循视觉阅读顺序
- [ ] 跳过链接和页面标题存在

## 直接组合的元素（不通过组件）

分为两个列表：

**使用的现有元素合同:**
- {例如，`button-primary` — FAB}

**内联存根（提升候选）:**
- {例如，`page-topbar` — 使用方：dashboard-shell-page。当 ≥2 个页面使用时提升。}

第一个列表是本身已有合同并被直接组装到此页面的原子元素。第二个列表是还没有合同但应该在 ≥2 个页面使用时提取的原子元素。保持它们分开。
