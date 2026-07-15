# 组件合同: {组件名称}

元素 + 数据绑定 + 布局的组合。组件**选择**和**定位**元素；它们不能重新定义元素视觉规格。如果设计需要现有元素未覆盖的变体，创建新元素合同 — 不要从组件中覆盖。

## 元数据

| 字段          | 值                                           |
|----------------|-------------------------------------------------|
| 组件         | {例如，revenue-breakdown-widget}                |
| 版本        | {1.0}                                           |
| 设计来源  | {Figma 节点 URL 或图片引用}             |
| 提取日期 | {YYYY-MM-DD}                                    |

## 用途

{一句话 — 此组件显示什么以及为什么。例如，"在产品类别上显示收入分解，带环形图和附带的图例表格，用于仪表板概述页面和分析详情页面。"}

## 卡片 Chrome 槽位（必填 — 填写每一行或明确标记 N/A）

每个组件都是一个带有一致 chrome 的卡片。缺失 chrome 是"看起来不太对"验证结果的 #1 原因。记录**每一个**槽位，即使为空。

| 槽位                    | 元素合同（或 N/A）                | 内容 / 行为                               | 对齐       |
|-------------------------|------------------------------------------|--------------------------------------------------|-----------------|
| `title`                 | heading-h3                               | {设计中的确切标题文本}                   | {left / center} |
| `subtitle`              | text-caption 或 N/A                      | {确切副标题文字 — "Which tools members interact with most."} | {left / center} |
| `header_right_control`  | select-dropdown, button-ghost, 或 N/A    | {例如，卡片头部中的 "Members ▼" 过滤器下拉菜单} | right           |
| `kpi_header`            | stat-card-kpi-large 或 N/A               | {例如，图表上方显示的 "2.4" + "Avg tools per member"} | {left / center} |
| `body`                  | {主要元素，例如 chart-donut}     | {主要视觉}                                    | {center / left} |
| `body_sidebar`          | {例如，legend-vertical-right 或 N/A}     | {与主体并排定位的元素}              | {left / center} |
| `footer`                | {例如，text-caption 或 N/A}              | {例如，"Last updated: ..."}                      | {left / center} |
| `footer_legend`         | {例如，legend-horizontal-bottom 或 N/A}  | {主体下方的图例}                              | {center / left} |

**规则**:
- 如果设计显示它，记录它。如果设计不显示，写 "N/A"。**不要留空**。
- **对齐**列是**必填**。对齐错误（左 vs 居中）是"看起来不太对"结果的 #2 原因，排在缺失 chrome 之后。从 Figma 节点提取对齐 — 不要默认左对齐。

## 使用的元素（主体组合）

| 槽位             | 元素合同                        | 理由                          |
|------------------|-----------------------------------------|------------------------------------|
| {主体元素}   | {例如，chart-donut}                     | {为什么选择此元素}                 |
| {侧边栏}        | {例如，legend-vertical-right}           | {为什么选择此变体}                 |

**规则**: 每个槽位通过名称从 `design-chart-taxonomy.md` 引用元素合同。组件**不能**覆盖元素视觉规格。要自定义，请创建新元素变体。

## 布局

```
┌──────────────────────────────────────────────┐
│ {title}                        [{filter}]    │
│ {subtitle}                                   │
├──────────────────────────────────────────────┤
│              │                               │
│   {chart}    │      {legend}                 │
│              │                               │
├──────────────────────────────────────────────┤
│          {footer_legend}                     │
└──────────────────────────────────────────────┘
```

### 卡片容器

| 属性           | 值                                               |
|--------------------|-----------------------------------------------------|
| container_width    | {父元素的 100% / 固定 480px}                      |
| container_height   | {auto / 固定 320px}                                |
| padding            | {16px — 从 Figma 提取精确值}             |
| background         | {#ffffff}                                           |
| border             | {1px solid #e2e8f0}                                 |
| border_radius      | {8px}                                               |
| shadow             | {none / 0 2px 8px rgba(0,0,0,0.1)}                 |

### 内部元素布局（必填 — "看起来不太对"杀手）

此部分指定元素在卡片主体内如何被**定位、间距和对齐**。缺失或错误的值会产生"组件内间距"和"图例对齐不正确"类错误。

| 属性                    | 值                                                      |
|-----------------------------|------------------------------------------------------------|
| header_to_body_gap          | {16px — 标题/副标题行与主体内容之间的间隙}   |
| body_layout                 | {flex-row / flex-column / grid}                            |
| body_justify                | {center / flex-start / space-between}                      |
| body_align                  | {center / flex-start / stretch}                            |
| body_gap                    | {24px — 主体元素与侧边栏元素之间的间隙}      |
| chart_width                 | {180px / 主体的 60% / auto}                               |
| chart_height                | {180px / auto}                                             |
| chart_align_self            | {center / flex-start}                                      |
| legend_width                | {auto / 主体的 40%}                                       |
| legend_align_self           | {center / flex-start}                                      |
| body_to_footer_gap          | {16px — 主体与 footer/footer_legend 之间的间隙}         |
| footer_legend_justify       | {center / flex-start — 从 FIGMA 提取，不要默认} |

**规则**:
- 从 Figma 节点提取**每个**值 — 不要估算。
- `footer_legend_justify` 很关键：居中对齐的图例看起来与左对齐的完全不同。查看 Figma。
- `body_layout` + `body_justify` + `body_align` 共同定义图表是在卡片中居中、左对齐还是拉伸。弄错了每个组件都"看起来不太对。"
- 这些值是**组件拥有的** — 它们描述组件如何定位其元素，不是元素的内部规格（后者在元素合同中）。

### 内部布局算术（固定高度卡片必填）

当 `container_height` 是固定值（不是 `auto`）时，你必须计算并记录内部高度预算。数学必须精确相加 — 不允许估算。

```
card_height:           {例如，334px}
card_padding_top:      {例如，16px}
card_padding_bottom:   {例如，16px}
header_height:         {title + subtitle + gap} = {例如，48px}
header_to_body_gap:    {例如，16px}
─────────────────────────────────────────────────
body_available:        {card_height - padding_top - padding_bottom
                        - header_height - header_to_body_gap}
                       = {例如，334 - 16 - 16 - 48 - 16 = 238px}

body_breakdown:
  kpi_height:          {自然内容高度，例如 40px — 不要用 flex:1}
  kpi_to_chart_gap:    {例如，16px}
  chart_section:       {bar + gap + labels + gap + legend}
                       = {例如，30 + 8 + 12 + 8 + 16 = 74px}
  ────────────────────
  total_body_content:  {40 + 16 + 74 = 130px}
  remaining_space:     {238 - 130 = 108px}

centering_strategy:    {例如，body 使用 flex-column + justify-content: center
                        在 238px 的 body 区域内垂直居中内容组（KPI + 图表）。
                        KPI 保持自然高度。}
```

**规则**:
- 每行必须是从 Figma 设计提取的精确像素值
- 所有主体内容的总和必须等于 `body_available` **或** 明确记录剩余空间如何分配（居中、内边距等）
- **永远不要在内容元素（KPI、标签、文字）上使用 `flex: 1` 来居中它。** `flex: 1` 使元素增长以填充可用空间，膨胀其盒模型。在**父容器**上使用 `flex: 1` + `justify-content: center`。父容器增长；子元素保持自然大小。
- 如果数学对不上，设计提取不完整 — 返回 Figma

## 数据绑定

**组件输入形状:**
```typescript
{
  title: string;
  timeRange: '7d' | '30d' | '90d' | '1y';
  data: { category: string; value: number; color?: string }[];
  onFilterChange?: (range: string) => void;
}
```

**元素数据映射:**
| 元素    | 接收                                                         |
|------------|------------------------------------------------------------------|
| chart      | `{ categories: data.map(d=>d.category), series: [{name:'Revenue', values: data.map(d=>d.value)}]}` |
| legend     | `data.map(d => ({label: d.category, value: d.value, color: d.color}))` |
| filter     | `{ value: timeRange, options: ['7d','30d','90d','1y'], onChange: onFilterChange }` |

## 测试夹具（必填）

验证工具包使用的组件范围夹具。必须包含：
- 顶级组件 chrome 字段（标题、副标题、过滤器值等）
- 每个组合元素的主体数据

优先引用元素的夹具而非重新内联其值：

```json
{
  "__fixture_source__": "extracted-from-figma | flat-contract | requirements | engineered-stub",
  "__figma_template__": "{Figma 节点 URL 或 null}",
  "title": "Most Popular Tools",
  "subtitle": "Which tools members interact with most.",
  "filterValue": "Members",
  "chart_fixture": "$ref:chart-donut#/fixture",
  "legend_fixture": "$ref:legend-vertical-right#/fixture"
}
```

**规则**:
- `__fixture_source__` 和 `__figma_template__` 是**必填**（与元素合同相同的夹具解析顺序）。
- 当组件使用元素的规范夹具未更改时，元素子夹具应通过 `$ref:{element-name}#/fixture` 引用。仅在组件提供组件特定数据时内联。
- 组件夹具**不得**包含属于元素的视觉规格字段（颜色、字号、内边距、圆角）。这些存在于元素合同中。
- **边界检查**: 如果字段名与元素夹具中的槽位匹配（segments、centerValue、xLabels 等），它属于元素夹具，不是组件夹具。

## 验证工具包

组件工具包页面（`/design-system/{widget-name}`）在空白页上渲染**一个**组件实例 — 无应用 chrome、无导航。组件**就是**工具包。使用上述测试夹具渲染组件；不要将其包装在页面级布局中。

## 状态

| 状态       | 组件行为                                                   |
|-------------|-------------------------------------------------------------------|
| loading     | 骨架微光替换图表和图例                        |
| empty       | 图表显示空状态；图例隐藏                            |
| error       | 错误横幅替换图表；过滤器保持启用                 |

## 响应式行为

| 断点 | 适应                                                     |
|------------|----------------------------------------------------------------|
| 移动端     | 图例降至图表下方；图表变为正方形                 |
| 平板     | 图例缩小到 35% 宽度                                    |
| 桌面端    | 规格如上所示                                          |

## 交互

- {图表分段悬停高亮对应的图例行}
- {图例行点击切换分段可见性}
- {过滤器更改通过 `onFilterChange` 触发数据重新获取}

## 无障碍

- **地标角色**: `region`，aria-labelledby 指向标题
- **键盘**: Tab 顺序：过滤器 → 图表 → 图例行
- **公告**: 数据更新通过 `aria-live="polite"` 宣布

## 实现备注

- **组件路径**: {src/widgets/RevenueBreakdownWidget.vue}
- **组合**: {列出组件导入的元素组件}
- **状态管理**: {本地状态 / zustand store / 仅 props}

## 验证清单

组件级验证在所有引用的元素通过自己的验证后运行。组件验证仅检查组合 — 元素内部不在范围内。

- [ ] 所有引用的元素存在且正确插槽
- [ ] 卡片 chrome 对齐匹配设计（标题左/居中，图例居中/左等）
- [ ] 内部元素布局匹配设计（body_layout, body_justify, body_align）
- [ ] 元素间距匹配设计（header_to_body_gap, body_gap, body_to_footer_gap）
- [ ] 元素大小匹配设计（chart_width, chart_height, legend_width）
- [ ] 图例对齐匹配设计（footer_legend_justify: center vs left）
- [ ] 卡片容器值匹配设计（内边距、边框、圆角、阴影）
- [ ] 布局算术相加：子元素高度总和 + 间距 = body_available（仅固定高度卡片）
- [ ] 无内容元素使用 `flex: 1` 居中 — 只有父容器可以使用 `flex: 1`
- [ ] DOM 盒模型检查：无元素的 offsetHeight >> 其内容高度（膨胀盒 = 错误 flex）
- [ ] 响应式断点按指定适应
- [ ] 数据绑定产生正确的元素输入（用示例数据抽查）
- [ ] 元素间交互触发（悬停同步、点击传播）
- [ ] 加载/空/错误状态正确渲染
- [ ] 无障碍地标和键盘顺序正确

## 被谁使用

**页面**: {列出引用此组件的页面合同}
