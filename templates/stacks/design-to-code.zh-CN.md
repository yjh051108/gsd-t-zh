# 设计转代码标准

这些规则是**强制性的**。违反即任务失败。无例外。

这些规则适用于将已有视觉设计实现为前端代码。设计已存在（Figma 文件、截图、图片、原型 URL）— 你的任务是在代码中以像素级精度忠实复现它。

---

## 0. 契约结构 — 扁平或分层

支持两种契约布局。根据项目规模选择:

**扁平**（单文件: `.gsd-t/contracts/design-contract.md`）
- 适用: 单页面、≤10 个不同元素、无跨页面复用
- 优点: 快速搭建；适合落地页或单次屏幕
- 缺点: 无复用；视觉规范重复；实例间易漂移

**分层**（目录: `.gsd-t/contracts/design/{elements,widgets,pages}/`）
- 适用: 多页面、可复用组件（图表、卡片、图例）、使用设计系统
- 优点: 元素契约是视觉规范的唯一真相源 — widgets 和 pages 选择和定位但不能覆盖。漂移在结构上不可能。
- 缺点: 前期更多契约（elements: ~10-20, widgets: ~5-10, pages: N）
- 引导方式: `/gsd-t-design-decompose {Figma URL 或图片路径}`
- 模板: `templates/element-contract.md`, `templates/widget-contract.md`, `templates/page-contract.md`

**优先级规则（仅分层模式）**:
```
元素契约  >  widget 契约  >  page 契约
```
使用 `chart-donut` 的 widget 不能改变 `chart-donut` 的 bar-gap、颜色或标签位置。如需定制，创建新元素变体（`chart-donut-compact.contract.md`）。

**分层执行顺序（分层契约存在时强制）**:
```
构建顺序:
  Wave 1: 元素    — 从元素契约中隔离构建每个元素
                      每个元素一个任务。每个按契约验证。
  Wave 2: Widgets — 导入已构建的元素，按 widget 契约组合
                      每个 widget 一个任务。验证组装匹配契约。
  Wave 3: 页面    — 导入已构建的 widgets，按 page 契约组合
                      每个页面一个任务。设计验证代理在此运行。

禁止内联重建:
  Widget 任务必须导入元素组件。如果 chart-donut 存在于
  src/components/elements/，你必须导入它 — 不构建第二个 donut。
  Page 任务必须导入 widget 组件。Page 的工作是组合和数据绑定，
  不是重新实现 widgets。
  内联重建低级组件是任务失败。

契约即权威:
  如果元素契约说 'bar-vertical-grouped'（垂直柱状图），
  就构建垂直柱状图 — 即使 Figma 截图看起来模糊。
  契约来自仔细的设计分析。不确定时，跟随契约而非截图。
```

**执行时检测**:
- `.gsd-t/contracts/design/` 存在 → 分层模式，先验证元素，再 widgets，再 pages
- `.gsd-t/contracts/design-contract.md` 存在 → 扁平模式
- 否则 → partition 时引导扁平契约

---

## 1. 设计系统检测

```
强制:
  ├── 任何提取或实现前，检查是否有设计系统:
  │     问用户: "是否使用设计系统或组件库（如 shadcn-vue, Vuetify, Radix, MUI, Ant Design, Chakra）？
  │       如果是，提供 URL。"
  ├── 如果是:
  │     获取库的文档首页
  │     编目可用组件（cards, tables, tabs, charts, buttons, inputs, dialogs, dropdowns 等）
  │     识别主题系统（CSS 变量、Tailwind config、theme object）
  │     确定定制模型:
  │       复制粘贴（shadcn）→ 完全控制，直接编辑组件源码
  │       配置驱动（MUI theme）→ 通过 theme overrides 定制
  │       工具类优先（Tailwind + headless）→ 通过 utility classes 样式化
  │     将设计元素映射到库原语 — 存在匹配时使用库组件而非自定义
  │     在设计契约中记录: 库名称、URL、版本、使用的组件、主题方法
  ├── 如果否:
  │     进行完全自定义实现
  │     在设计契约中记录: "无设计系统 — 所有组件自定义"
  └── 为什么: 设计系统组件开箱即提供经过验证的无障碍、交互状态和响应式行为。
       已有库组件时构建自定义浪费精力且产生更差结果（缺少 focus 状态、ARIA 等）
```

**禁止** — 已有 shadcn-vue 提供无障碍和 Tailwind 主题时仍从头构建自定义 card、dropdown 和 table。

**正确** — 检测 shadcn-vue，将设计中 60% 的 UI 元素映射到库组件，通过 Tailwind theme tokens 定制，仅构建库不覆盖的部分（专业图表、领域特定 widgets）。

---

## 2. 设计源设置

```
强制:
  ├── 不写 CSS 或布局代码前必须有设计参考
  ├── 识别源类型: Figma 文件、图片、截图、原型 URL
  ├── 如果源是 Figma URL/文件 → 检查 Figma MCP 是否可用
  │     是 → 按 widget/component node 使用 Figma MCP `get_design_context`
  │           `get_design_context` 返回结构化代码、组件属性和设计 tokens — 从中提取值。
  │           ⚠ 绝不使用 `get_screenshot` 做提取 — 它返回像素而非属性。
  │             你无法可靠地从图片中提取精确间距、颜色或文本。
  │             `get_screenshot` 仅用于验证（视觉对比构建输出和设计）。
  │     否 → 告知用户: "推荐 Figma MCP 用于精确提取"
  │         备选: 用图像分析（Claude 多模态视觉）
  ├── 如果源是图片/截图 → 用视觉分析提取值
  ├── 在设计契约中存储源引用
  └── 未完成提取步骤前绝不开始实现
```

**禁止** — 扫一眼设计凭记忆或近似写 CSS。

**正确** — 在写一行 CSS 前系统性地从设计工具中提取每一个值。

---

## 3. MCP 和工具检测

```
强制:
  ├── 提取前检测可用工具:
  │     Figma MCP → 从 Figma 文件精确提取 tokens
  │       `get_design_context` → 结构化代码 + tokens（用于提取）
  │       `get_metadata` → 页面 widget/component 节点枚举（用于找节点）
  │       `get_screenshot` → 纯视觉图片（绝不用于提取 — 仅用于构建后验证对比）
  │     Claude Preview → 渲染 + 截图用于验证循环
  │     Chrome MCP → 备选渲染 + 截图用于验证
  ├── 如果有 Figma MCP 且源是 Figma:
  │     调用 `get_metadata` 列举页面 widget/component 节点
  │     按 widget 节点调用 `get_design_context` 提取结构化数据
  │     从响应中提取精确颜色、间距、字体、组件结构
  │     MCP `get_design_context` 的值是权威 — 覆盖视觉估计
  ├── 如果没有 Figma MCP 但源是 Figma:
  │     推荐设置: "推荐安装 Figma MCP server 用于精确提取。
  │       远程（推荐）: https://mcp.figma.com/mcp
  │       或安装包含 MCP 设置的 Figma Plugin for Claude Code。"
  │     备选: 请求每个组件 1x 和 2x 的截图/导出
  │     用视觉分析 — 在设计契约中标注精度降低
  ├── 在设计契约 Source 部分记录使用的工具
  └── 未来 MCPs（Sketch, Adobe XD, Penpot）遵循相同模式
```

**禁止** — 忽略可用 MCP，凭截图估计。

**正确** — 检测 Figma MCP，用它提取精确 `fill: #1A73E8`、`font-size: 14px`、`padding: 16px 24px`，然后从这些精确值写 CSS。

---

## 4. 技术栈能力评估

```
强制:
  ├── 实现前，评估项目所选技术栈能否像素级满足该设计的特定要求:
  │
  ├── 根据设计要求评估以下能力:
  │     CSS Grid / Flexbox 支持 → 复杂布局
  │     自定义字体加载 → 非系统字体
  │     CSS 自定义属性 → 设计 token 系统
  │     动画/过渡支持 → 交互状态、微交互
  │     SVG 支持 → 图标、插图、复杂形状
  │     响应式单位（clamp, container queries）→ 流体缩放
  │     伪元素（::before, ::after）→ 装饰元素
  │     背景滤镜/混合模式 → 毛玻璃、叠加
  │     渐变支持 → 复杂渐变填充
  │     组件隔离 → 样式隔离（CSS Modules, Shadow DOM, scoped styles）
  │
  ├── 对每个设计要求评估:
  │     支持 → 技术栈原生处理，继续
  │     部分 → 需要附加库 — 命名它，用 GSD-T 单位标注范围（domain/wave/spawn/token，不用 dev-hours）
  │     不支持 → 技术栈无法实现 — 标记为 blocker
  │
  ├── 如果有任何要求不支持:
  │     停止并向用户展示:
  │       1. 设计要求
  │       2. 当前技术栈无法做什么
  │       3. 推荐替代方案:
  │           示例: "设计要求 backdrop-filter blur — 当前技术栈使用不支持的旧浏览器目标。
  │           选项: (a) 更新 browserslist 为仅现代浏览器
  │           (b) 从 CSS Modules 切换到 Tailwind（有 backdrop-blur utility）
  │           (c) 用 polyfill（降低精度）"
  │       4. 等待用户决定后继续
  │
  ├── 如果设计需要组件库:
  │     评估: 它能定制到精确匹配设计吗？
  │     风格强加的组件库（Material UI defaults, Bootstrap themes）通常
  │     与像素级定制设计冲突
  │     需要定制时推荐 headless/unstyled 替代:
  │       Radix UI, Headless UI, React Aria, Shadcn/ui（Tailwind 基础）
  │
  └── 所有发现记录在设计契约的 Stack Evaluation 表中
```

**禁止** — 用 Material UI 开始实现，中途发现无法匹配设计的自定义 border radius、shadow 和间距，因为 MUI 的主题系统与之冲突。

**正确** — 提前评估: "设计使用自定义 card shadows 和非标准间距。MUI 的 elevation 系统不匹配。推荐: Tailwind + Radix 实现完全样式控制，或 MUI + 完全自定义主题 override。"

---

## 5. 设计 Token 提取协议

```
强制:
  ├── 写任何实现代码前提取 EVERY 值:
  │     颜色    → 每个 fill, stroke, 文本色的精确 hex/rgba/hsl
  │     字体     → family, weight, size, line-height, letter-spacing 每个文本样式
  │     间距     → 每个元素的 padding, margin, gap 值
  │     边框     → radius, width, style, color
  │     阴影     → x-offset, y-offset, blur, spread, color
  │     透明度   → 任何透明度值
  │     尺寸     → 固定大小元素的精确 width/height
  │     Z-index  → 重叠元素的层级顺序
  ├── 每个 token 记录使用上下文（哪个元素，什么状态）
  ├── 将 tokens 分组为一致的命名系统（--color-primary, --spacing-md 等）
  ├── 交叉引用: 如果一个值出现多次，它是共享 token
  └── 所有 token 写进 .gsd-t/contracts/design-contract.md 后开始写代码
```

**禁止** — `padding: 15px` 因为 "看起来差不多"。

**正确** — 从设计工具提取 `padding: 16px`，记录为 `--spacing-md: 1rem`，在设计契约中追踪到 "card container padding"。

---

## 6. 设计契约生成

```
强制:
  ├── 提取的 tokens 写入 .gsd-t/contracts/design-contract.md
  │     使用 templates/design-contract.md 模板
  ├── 实现中的每个 CSS 值必须追溯到契约条目
  ├── 如果值不在契约中，提取不完整 — 回去补全
  ├── 契约是唯一真相源 — 不是代码，不是记忆
  └── 实现过程中设计变更时更新契约
```

设计契约的作用与 GSD-T 中的 API 契约相同: 定义设计和代码之间的精确接口。任何偏差都是违规。

---

## 7. 组件分解

```
强制:
  ├── 编码前分析设计，产出组件树:
  │     根容器 → 区块 → 组件 → 子组件 → 原子
  ├── 识别重复模式 → 这些成为可复用组件
  ├── 识别变体状态 → 这些成为组件 props
  │     示例: Button 有 primary/secondary/ghost → variant prop
  ├── 识别插槽边界 → 动态内容注入的位置
  ├── 将树映射到框架的组件模型（React, Vue 等）
  ├── 语义化命名 — 设计层名清晰时匹配
  └── 在设计契约的 Component Tree 部分记录树
```

**禁止** — 写一个 400 行的单体组件渲染整个页面。

**正确**
```
Page
  ├── Header
  │     ├── Logo
  │     ├── NavLinks
  │     └── UserMenu（variant: logged-in | logged-out）
  ├── HeroSection
  │     ├── Headline
  │     ├── Subheadline
  │     └── CTAButton（variant: primary）
  ├── FeatureGrid
  │     └── FeatureCard (x3, 可复用)
  │           ├── Icon
  │           ├── Title
  │           └── Description
  └── Footer
```

---

## 8. 布局分析

```
强制:
  ├── 识别每个容器的布局系统:
  │     是 grid? → CSS Grid 带显式 columns/rows/gaps
  │     是 row/column? → Flexbox 带显式 direction/gap/alignment
  │     是 positioned? → Relative/absolute 带精确偏移
  ├── 精确测量元素间的 gap 值 — 绝不近似
  ├── 识别对齐: start, center, end, stretch, space-between
  ├── 确定尺寸: 固定 width/height vs flex-grow vs percentage vs min/max
  ├── 注意内容溢出行为: hidden, scroll, wrap, ellipsis
  └── 在设计契约中按断点文档化布局
```

**禁止** — `display: flex; gap: 10px;` 不测量实际 gap。

**正确** — 从设计提取精确 `gap: 24px`，然后: `display: flex; gap: 1.5rem; /* 24px — design contract: section-gap */`

### Flex 居中反模式（强制）

```
绝不使用 flex: 1 在内容元素上居中它的文本/内容。
flex: 1 使元素增长以填充可用空间 — 内容在超大框内居中，但框本身排挤兄弟元素。

  错误 — 内容元素增长，膨胀的框移动布局:
    .kpi { flex: 1; display: flex; justify-content: center; }

  正确 — 父元素增长，子元素保持自然大小:
    .body { flex: 1; display: flex; flex-direction: column;
            justify-content: center; }
    .kpi  { /* 没有 flex: 1 — 仅自然高度 */ }

  规则: flex: 1 属于容器，不属于内容元素。
        垂直居中内容时，在父元素上应用 justify-content: center
        — 绝不在子元素上用 flex: 1。
```

### 固定高度容器算术（强制）

```
当 card 或容器有固定高度时，写 CSS 前:
  1. 计算总可用 body 高度:
     body_available = card_height - padding_top - padding_bottom
                      - header_height - header_to_body_gap
  2. 列出每个子元素的高度（从设计契约）
  3. 列出子元素之间的每个 gap
  4. 求和: total_content = child1 + gap1 + child2 + gap2 + ...
  5. 比较: total_content 必须 ≤ body_available
  6. 如果 total_content < body_available:
     记录居中策略（父元素 justify-content: center）
  7. 如果 total_content > body_available:
     设计提取有误 — 回 Figma

  此算术记在 widget 契约的 Internal Layout Arithmetic 部分。
  实现必须匹配算术。
  如果 gap: 12px 导致计算超过 body_available，用 gap: 8px。
```

---

## 9. 响应式断点策略

```
强制:
  ├── 编码前分析设计的断点行为
  │     什么布局变化？（堆叠、重排、隐藏、缩放）
  │     什么字体变化？（font-size, line-height）
  │     什么间距变化？（padding, margins, gaps）
  ├── 明确定义断点 — 匹配设计的目标视口
  │     常见: mobile 375px, tablet 768px, desktop 1280px, wide 1440px+
  ├── 按项目约定选择移动优先或桌面优先
  ├── 合适时使用流体值:
  │     clamp(min, preferred, max) 用于字体大小
  │     percentage 或 vw 用于灵活容器
  │     container queries 用于组件级响应式
  ├── 绝不假设 "中间尺寸会工作" — 测试每个断点
  └── 在设计契约中记录断点行为
```

**禁止** — 只构建桌面版，然后事后添加 `@media (max-width: 768px)`。

**正确** — 提前分析所有断点，移动优先构建，渐进增强:
```css
/* Mobile (默认) */
.feature-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
/* Tablet */
@media (min-width: 768px) { .feature-grid { grid-template-columns: repeat(2, 1fr); gap: 1.5rem; } }
/* Desktop */
@media (min-width: 1280px) { .feature-grid { grid-template-columns: repeat(3, 1fr); gap: 2rem; } }
```

---

## 10. 语义化 HTML 结构

```
强制:
  ├── 使用语义化元素: nav, main, section, article, aside, header, footer
  ├── 标题层级: 每页一个 h1，h2 → h3 → h4 顺序，不跳过
  ├── 交互元素: 操作用 button，导航用 a — 不用带 onClick 的 div
  ├── 表单元素: label + input 配对，fieldset + legend 用于分组
  ├── ARIA landmarks: 语义化 HTML 不够时才用 role 属性
  ├── Alt 文本: 内容图要描述，装饰图用空 alt（alt=""）
  ├── Tab 顺序: 逻辑顺序，跟随视觉布局，不用正数 tabindex
  └── 焦点指示器: 每个交互元素可见
```

**禁止** — `<div class="button" onclick="...">Click me</div>`

**正确** — `<button type="button" class="cta-button">Click me</button>`

---

## 11. 命名规范（类名、ID、Data 属性）

```
强制:
  ├── CSS 类命名 — 每个项目只用 ONE 一致规范:
  │     BEM: .block__element--modifier（如 .card__title--highlighted）
  │     Tailwind: 仅 utility classes（不需要自定义类名）
  │     CSS Modules: camelCase（如 styles.cardTitle）
  │     Scoped CSS (Vue/Svelte): 语义化 kebab-case（如 .card-title）
  │     同一项目绝不混用规范
  ├── IDs — 只在需要时使用:
  │     表单 label 关联: <label for="email-input">
  │     锚点目标: <section id="pricing">
  │     ARIA 引用: aria-labelledby, aria-describedby
  │     绝不用 ID 做样式 — 只用 class
  │     绝不用自动生成或无意义 ID（id="div1", id="el-47"）
  ├── Data 属性 — 用于 JavaScript hooks 和测试:
  │     data-testid 用于测试选择器（如 data-testid="submit-button"）
  │     data-* 用于组件状态/配置（如 data-active="true"）
  │     绝不用 class 或 ID 做 JS 选择 — 用 data 属性
  ├── 组件命名 — 匹配设计系统:
  │     如果 Figma 层名 "Hero/CTA Button" → 组件名 CTAButton
  │     设计系统有 "Card > Title" → class 是 .card__title 或 .card-title
  │     代码名与设计名对齐以便追溯
  ├── 语义化命名 — 描述目的，不是外观:
  │     禁止: .blue-text, .big-box, .left-panel, .mt-20
  │     正确: .primary-action, .feature-card, .sidebar, .section-spacing
  │     例外: Tailwind 中的 utility classes（按设计就是外观导向的）
  └── 文件命名 — 匹配组件名:
        组件: FeatureCard.vue → 样式: feature-card.css 或 scoped
        组件: HeroSection.tsx → 测试: HeroSection.test.tsx
```

**禁止** — `<div class="div1 blue-thing" id="x47" onclick="...">`

**正确** — `<section class="feature-card" data-testid="feature-card-pricing">`

---

## 12. CSS 精度规则

```
强制:
  ├── 每个值必须追溯到设计契约 — 没有 "看起来差不多"
  ├── 设计 tokens 用 CSS 自定义属性:
  │     :root { --color-primary: #1A73E8; --spacing-md: 1rem; }
  ├── 没有注释追溯设计规范的 magic number
  │     禁止:  padding: 13px;
  │     正确: padding: var(--spacing-card); /* 16px — design contract: card-padding */
  ├── 一致单位: 间距/字体用 rem，边框/阴影用 px
  ├── 全局 box-sizing: border-box
  ├── 项目使用 Tailwind 时: 用设计契约的精确值扩展主题配置
  └── 零容忍偏差 — 设计说 16px，代码就是 16px
```

**禁止** — 自由风格 CSS，值凭感觉写。

**正确** — 每个值可追溯:
```css
.card {
  padding: var(--spacing-lg);         /* 24px — design contract */
  border-radius: var(--radius-md);    /* 8px — design contract */
  box-shadow: var(--shadow-card);     /* 0 2px 8px rgba(0,0,0,0.1) — design contract */
  background: var(--color-surface);   /* #FFFFFF — design contract */
}
```

---

## 13. 字体渲染

```
强制:
  ├── 字体加载: preload 主字体，使用 font-display: swap
  ├── 设计中的精确值: family, weight, size, line-height, letter-spacing
  │     绝不近似: "看起来像 14px" → 测量它，确认它
  ├── Line-height: 用无单位值（1.5，不是 24px）以支持缩放
  │     例外: 固定高度单行元素用 px 匹配设计
  ├── Letter-spacing: 设计工具单位需要时转换
  │     Figma 用百分比或 px；CSS 用 em 或 px
  │     0.5% in Figma ≈ 0.005em in CSS
  ├── 文本溢出: 匹配设计行为（ellipsis, wrap, clamp lines）
  ├── 字体 weight 映射: 设计工具用名称 — 映射为数值
  │     Thin=100, Light=300, Regular=400, Medium=500, SemiBold=600, Bold=700
  └── 响应式字体: 用 clamp() 或断点特定尺寸 — 按设计
```

**禁止** — `font-size: 16px; line-height: 1.5;` 不检查实际设计值。

**正确** — 精确提取:
```css
.headline {
  font-family: var(--font-heading);       /* Inter — design contract */
  font-weight: 600;                        /* SemiBold — design contract */
  font-size: clamp(1.5rem, 2vw, 2.25rem); /* 24-36px responsive — design contract */
  line-height: 1.3;                        /* 31.2px at 24px — design contract */
  letter-spacing: -0.01em;                 /* -0.16px at 16px — design contract */
}
```

---

## 14. 颜色精度

```
强制:
  ├── 精确提取颜色值 — 绝不近似
  │     #1A73E8 不是 #1A74E9 — 精确匹配
  ├── 使用设计工具的格式: 实色用 hex，透明色用 rgba
  ├── 定义为 CSS 自定义属性 — 不在样式表中到处硬编码
  ├── 渐变: 提取精确 stop（color + position %）
  ├── 透明度: 通过 rgba/hsla 或 opacity 属性 — 匹配设计的方法
  ├── 暗色模式（如适用）:
  │     每个 light token 映射到 dark 等价物
  │     按项目约定使用 prefers-color-scheme 或 class 切换
  ├── 语义化命名: --color-primary, --color-text-secondary, --color-surface
  │     不用 --blue-500 — 用设计意图，不是视觉描述
  └── 背景图片/图案: 正确分辨率导出，retina 用 srcset
```

**禁止** — 设计用 `#1A73E8` 时用 `blue` 或 `#0000ff`。

**正确** — 精确匹配 + 语义化命名:
```css
:root {
  --color-primary: #1A73E8;
  --color-primary-hover: #1557B0;
  --color-text-primary: #202124;
  --color-text-secondary: #5F6368;
  --color-surface: #FFFFFF;
  --color-border: #DADCE0;
}
```

---

## 15. 交互状态

```
强制:
  ├── 每个交互元素必须有所有状态:
  │     default, hover, focus-visible, active, disabled
  ├── 从设计中提取状态样式 — 设计师通常会规范这些
  │     未指定时: 合理推导（hover = 稍微深/浅）
  │     推导的状态在设计契约中标注 "derived"
  ├── 过渡: 指定时长和缓动 — 不依赖浏览器默认
  │     标准: transition: all 150ms ease-in-out（或按设计规范）
  ├── 焦点指示器: 可见、高对比、不是仅 outline:none
  ├── 触摸目标: 移动端最小 44x44px — 需要时用透明区域补充
  ├── 光标状态: 可点击用 pointer，禁用用 not-allowed，输入用 text
  └── 加载状态: 异步操作期间 skeleton/spinner/disabled
```

**禁止** — 仅样式化默认状态，hover/focus 用浏览器默认。

**正确**
```css
.cta-button {
  background: var(--color-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 150ms ease-in-out, transform 100ms ease-in-out;
}
.cta-button:hover { background: var(--color-primary-hover); }
.cta-button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cta-button:active { transform: scale(0.98); }
.cta-button:disabled { background: var(--color-border); cursor: not-allowed; opacity: 0.6; }
```

---

## 16. 视觉验证 — 对比 Figma，不仅是契约

**视觉验证由设计验证代理处理**，`gsd-t-execute`（Step 5.25）在所有域任务完成后自动生成。

### 关键区别: 两个验证目标

验证代理对比构建的前端与 **两个来源** — 不是只有一个:

```
验证目标（按此顺序运行）:
  ├── 目标 0: 元素数量对齐（先运行）
  │     构建的页面是否有与 Figma 设计相同数量的 widgets 和元素？
  │     缺失的 widget 是最严重的偏差 — 在属性比较前捕获。
  │
  ├── 目标 1: 构建屏幕 vs 设计契约
  │     代码是否匹配契约的声明值？
  │     （这是 13 任务验证证明可靠的 — 严密的。）
  │
  ├── 目标 2: 构建屏幕 vs FIGMA 设计（强制）
  │     构建的屏幕是否匹配原始 FIGMA 结构化数据？
  │     捕获: 契约一开始就错了、图表类型错误分类、幻觉数据、缺失元素。
  │
  ├── 目标 3: SVG 结构覆盖（强制）
  │     导出 Figma 帧为 SVG → 解析元素位置/尺寸/颜色
  │     → 几何对比构建 DOM 边界框。
  │     捕获: 聚合间距漂移、对齐问题、通过属性检查但视觉上看起来错误的比例错误。
  │
  └── 目标 4: DOM Box Model 检查（固定高度容器）
        按子元素评估 offsetHeight vs scrollHeight。
        捕获: 膨胀的 flex 框、错误的空间分布、超过内容大小的元素。
```

每个目标捕获不同的失败类别。目标 0: 缺失元素。目标 1: 错误值。目标 2: 错误契约。目标 3: 错误位置。目标 4: 错误空间分布。五个都是必需的 — 没有单一层能捕获全部。

### 验证代理工作流

```
关注点分离:
  ├── 编码代理（你 — 上面的第 1-15 节）:
  │     提取 tokens → 写精确 CSS → 每个值追溯到设计契约
  │     不要打开浏览器或尝试自己做视觉对比
  │
  └── 设计验证代理（gsd-t-execute Step 5.25）:
        1. 打开浏览器 → 在每个断点截图构建页面
        2. 按 widget 节点获取 Figma 结构化数据通过 `get_design_context`
           ⚠ 不用 `get_screenshot` 获取 Figma 数据 — 它返回无法精确提取的像素。
             `get_design_context` 返回结构化代码、组件属性和设计 tokens。
           用 `get_metadata` 先列举 widget 节点，然后
             每个 widget 节点用 `get_design_context`。
        3. 结构化对比: 构建页面值 vs Figma `get_design_context` 值
        4. 对页面上的每个 widget/section:
           a. `get_design_context` 说这个 Figma 节点包含什么？
              （图表类型、文本内容、布局属性、颜色）
           b. 代码实际构建了什么？（检查构建页面 DOM/styles）
           c. 它们匹配吗？不是 "代码匹配契约" — 是 代码匹配 FIGMA？
        5. 检查每个文本标签: 构建屏幕是否显示与 Figma `get_design_context`
           响应相同的标题、副标题、列标题、图例项、KPI 值？
        6. 生成结构化对比表（30+ 行）:
           | 元素 | Figma (get_design_context) | 构建 | 匹配/偏差 |
        7. SVG 结构覆盖 — 机械几何对比:
           a. 导出 Figma 帧为 SVG（API/MCP 或用户提供）
           b. 解析 SVG DOM: 每个元素的位置、尺寸、填充、文本
           c. 通过文本 + 位置邻近度映射 SVG 元素 → 构建 DOM 元素
           d. 几何对比: 位置（≤2px=匹配）、尺寸、颜色、文本
           e. 生成 SVG diff 表:
              | SVG 元素 | SVG 位置 | 构建位置 | Δ px | 结论 |
           f. 标记未映射元素（构建中缺失 / 构建中多余）
           g. 捕获属性检查通过但视觉上看起来错误的聚合间距/对齐漂移
        8. 修复偏差 → 重新验证 → artifact gate 强制完成
```

验证代理执行 **默认失败** 规则: 每个视觉元素开始为 UNVERIFIED。唯一有效结论是 MATCH（有证明）或 DEVIATION（有具体说明）。"看起来接近" 和 "似乎匹配" 不是结论。编排器中的 artifact gate 在对比表缺失或为空时阻止完成。

> **为什么 "vs Figma" 重要**: 两终端验证（v2.59-v2.67，13 任务，全部 50/50）证明 契约→代码 可靠。但当构建屏幕与实际 Figma 设计对比时，出现了重大偏差: 错误图表类型（甜甜圈而非堆叠柱状图）、幻觉列标题、虚构数据模型 — 这些都对其（错误的）契约打了 50/50。验证 Figma 而非仅契约是解决方案。

---

## 17. 反模式

```
绝不做这些:
  ├── 凭感觉估值 — "看起来大约 12px padding"（提取精确值）
  ├── 无追溯性的硬编码 — 没有设计引用的 magic number
  ├── "差不多" 心态 — 设计说 16px，代码写 14px 就是失败
  ├── 仅桌面端实现 — 忽视响应式断点
  ├── 无状态组件 — 只样式化默认，忽视 hover/focus/disabled
  ├── 仅存在性测试 — 检查元素存在不做视觉验证
  ├── 跳过提取步骤 — 直接跳到写代码
  ├── 近似颜色 — 用 "接近" 的色调而非精确值
  ├── 忽视字体细节 — 错误 font weight、缺失 letter-spacing
  ├── 到处用固定像素值 — 不用 rem/em 做可缩放尺寸
  ├── 混合样式方法 — 同一项目中 Tailwind + 行内样式 + CSS modules
  └── 跳过验证循环 — 提交未验证的视觉输出
```

---

## 18. 设计转代码验证清单

标记任何设计实现任务完成前:

- [ ] 已识别设计系统/组件库（或确认无）并在设计契约中记录
- [ ] 库组件映射到设计元素 — 仅在没有库匹配时自定义构建
- [ ] 已识别设计源并在设计契约中记录
- [ ] INDEX.md 记录元素数量（每页 widgets，每页 elements）
- [ ] 构建页面元素数量匹配 Figma 元素数量（无缺失/多余 widgets）
- [ ] 技术栈能力已评估 — 所有设计要求可实现（或替代方案已批准）
- [ ] 所有设计 tokens 已提取（颜色、字体、间距、边框、阴影）
- [ ] Tokens 写入 `.gsd-t/contracts/design-contract.md`
- [ ] 组件树已文档化并匹配设计层级
- [ ] 每个 CSS 值追溯到设计契约条目
- [ ] CSS 自定义属性（或 Tailwind config）定义所有设计 tokens
- [ ] 使用语义化 HTML（无 div 汤，正确的标题层级）
- [ ] 命名规范一致: class（BEM/Tailwind/Modules/scoped）、ID（最少、语义化）、data-testid 用于测试 hooks
- [ ] 所有交互状态已实现（hover, focus, active, disabled）
- [ ] 所有目标断点已实现响应式行为
- [ ] 移动端、平板、桌面端宽度都完成了视觉验证循环
- [ ] 字体精确: family, weight, size, line-height, letter-spacing 全部匹配
- [ ] 颜色精确: 每个 fill, stroke, 文本色匹配设计值
- [ ] 间距精确: 每个 padding, margin, gap 匹配设计值
- [ ] 无障碍: 焦点指示器、alt 文本、需要的 ARIA、44px 触摸目标
- [ ] 无 magic number — 每个值都记录或使用设计 token
- [ ] SVG 结构覆盖对比已完成 — 每个元素几何差异 ≤2px
- [ ] DOM box model 检查通过 — 无膨胀元素（offsetHeight >> scrollHeight）
- [ ] 布局算术已验证 — 子元素高度 + gaps = body 可用高度（固定高度 cards）
- [ ] 没有内容元素用 `flex: 1` 做居中 — 仅父容器
- [ ] 验证结果记录在设计契约 Verification Status 表
