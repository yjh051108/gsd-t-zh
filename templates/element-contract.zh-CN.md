# 元素合同: {元素名称}

原子视觉单元。每种视觉变体一份合同（例如，`chart-bar-stacked-horizontal` 和 `chart-bar-stacked-vertical` 是独立的合同）。组件和页面通过名称引用元素合同；它们**不能**覆盖视觉规格。

## 元数据

| 字段          | 值                                                     |
|----------------|-----------------------------------------------------------|
| 元素        | {例如，chart-bar-stacked-horizontal}                      |
| 类别       | {图表 / 图例 / 坐标轴 / 卡片 / 表格 / 控件 / 布局} |
| 变体于     | {基础元素名称，若为基础则填 `null`}                    |
| 版本        | {1.0}                                                     |
| 扩展        | {[axis-x-numeric, axis-y-categorical] — 或 []}            |
| 设计来源  | {Figma 节点 URL 或设计文件路径 + 节点 ID}             |
| 提取方式  | {Figma MCP / 视觉分析 / 设计令牌}             |
| 提取日期 | {YYYY-MM-DD}                                              |

## 用途

{一句话 — 此元素是什么以及何时使用。例如，"用于跨分类显示部分与整体比较的水平堆叠条形图，当分段宽度 ≥40px 时在内部显示分段标签。"}

## 视觉规格

| 属性      | 值                                                 |
|---------------|-------------------------------------------------------|
| {维度_1} | {精确值，尽量引用设计令牌} |
| {维度_2} | {精确值}                                         |

*列出每个可测量的视觉属性：尺寸、间距、圆角、边框、阴影、透明度。尽可能引用设计令牌而非原始值（`tokens.spacing.4` 而非 `16px`）。*

### 图表类型特有必填属性

上述自由格式表格是必要的但不够充分。对于图表元素，以下属性基于图表类别**必填** — 从 Figma MCP `get_design_context` 提取精确值或从截图测量。缺少其中任何一项是"看起来不太对"的原因。

**条形图**（`chart-bar-*`）:
| 属性 | 描述 | 示例 |
|----------|-------------|---------|
| `bar_width` | 每个条形的宽度（px 或可用空间的百分比） | `32px` / `60%` |
| `bar_gap` | 组内条形之间的间隙（仅分组图） | `4px` |
| `bar_group_gap` | 分类组之间的间隙 | `24px` |
| `corner_radius` | 条形末端的圆角（垂直图为顶部，水平图为右侧） | `4px top` / `0` |
| `label_position` | 百分比/数值标签出现的位置 | `inside-center` / `outside-right` / `above` |
| `label_min_width` | 显示标签的最小条形宽度（更小时隐藏） | `40px` |
| `segment_order` | 堆叠图：系列从底部/左侧到顶部/右侧的顺序 | `[NM, MT, OK, TX, IL]` |
| `orientation` | 水平与垂直的明确确认 | `vertical` |

**圆形图**（`chart-donut`，`chart-pie`，`chart-radial-bar`）:
| 属性 | 描述 | 示例 |
|----------|-------------|---------|
| `outer_diameter` | 图表总直径 | `180px` |
| `inner_diameter` | 中心孔直径（仅环形图，饼图为 0） | `100px` |
| `segment_order` | 分段从 12 点钟方向顺时针的顺序 | `[Steps, Broker, Video, Quick, Plan]` |
| `start_angle` | 第一个分段开始的方位 | `12 o'clock (0°)` |
| `label_position` | 百分比标签出现的位置 | `outside-radial` / `inside-segment` / `none` |
| `center_content` | 中心孔中显示的内容（环形图） | `"485" + "Total Interactions"` |

**折线图 / 面积图**（`chart-line-*`，`chart-area-*`）:
| 属性 | 描述 | 示例 |
|----------|-------------|---------|
| `stroke_width` | 线条粗细 | `2px` |
| `point_radius` | 数据点圆点半径（0 = 无圆点） | `4px` |
| `curve_type` | 线性, 贝塞尔, 阶梯 | `linear` |
| `fill_opacity` | 面积图：线下方的填充不透明度 | `0.3` |

**进度 / 仪表**（`chart-progress-ring`，`chart-progress-bar`）:
| 属性 | 描述 | 示例 |
|----------|-------------|---------|
| `track_width` | 背景轨道的宽度 | `12px` |
| `fill_width` | 进度填充的宽度（与轨道相同或更细） | `12px` |
| `track_color` | 背景轨道颜色 | `#e2e8f0` |

**如果你的元素是图表且尚未填写上述必填属性，停止。返回 Figma 提取它们。** 这些属性是"看起来接近"和"匹配"之间的区别。

## 标签 / 文字（如适用）

| 属性      | 值                                                              |
|---------------|--------------------------------------------------------------------|
| font_family   | {tokens.font.family.sans}                                          |
| font_size     | {tokens.font.size.sm}                                              |
| font_weight   | {tokens.font.weight.medium}                                        |
| color         | {tokens.color.text.primary}                                        |
| position      | {inside-segment-centered / above-bar / below-bar / left / right}   |
| visibility    | {always / conditional: {规则，例如 `hide if segment width <40px`}} |
| alignment     | {left / center / right / start / end}                              |
| truncation    | {none / ellipsis / tooltip-on-truncate}                            |

## 颜色

| 用途       | 令牌                                |
|-------------|--------------------------------------|
| {fill}      | {tokens.color.chart.sequence[0..n]}  |
| {stroke}    | {tokens.color.chart.border}          |
| {text}      | {tokens.color.text.onPrimary}        |
| {hover}     | {tokens.color.chart.hover.overlay}   |

## 状态

| 状态       | 视觉变化                                                      |
|-------------|--------------------------------------------------------------------|
| default     | {基础外观}                                                  |
| hover       | {例如，分段不透明度 1.0，兄弟 0.6，光标: pointer}         |
| active      | {例如，边框 2px tokens.color.accent}                             |
| disabled    | {例如，不透明度 0.4，光标: not-allowed}                           |
| focus       | {例如，轮廓 2px tokens.color.focus，偏移 2px}                 |
| loading     | {例如，骨架微光}                                           |
| empty       | {例如，占位符图标 + "无数据" 文字}                          |

## 交互

| 事件       | 行为                                                           |
|-------------|------------------------------------------------------------------|
| hover       | {例如，显示包含 {category, series, value, percent} 的工具提示}       |
| click       | {例如，发出 `onSegmentClick({category, series, value})`}           |
| keyboard    | {例如，Tab 聚焦，Enter 激活，箭头键在分段之间导航} |

## 数据绑定

**输入形状:**
```typescript
{
  // 定义渲染此元素所需的最小数据合同
  categories: string[];
  series: { name: string; values: number[]; color?: string }[];
}
```

**不变量:**
- {例如，所有 series 数组的长度必须 === categories.length}
- {例如，堆叠变体的值必须非负}

## 测试夹具（必填 — 从设计中提取，非占位符）

这是来自设计来源的**精确数据**。验证将使用此夹具渲染的构建组件与 Figma 设计进行比较。占位符数据（Lorem, foo/bar, Calculator/Planner）此处**禁止** — 验证者必须能够并排比较实际标签和数值。

### 夹具解析顺序（当设计没有具体数据时）

Figma 设计中经常包含模板令牌如 `{num}%`、`{value}`、`$X,XXX`，其中具体数字从未编码。当遇到这种情况，按以下顺序操作 — **不要发明无关的占位符标签**：

1. **Figma 文字节点中的具体值** → 逐字使用（最高优先级）。
2. **项目中现有的扁平 `design-contract.md`** → 如果卡片/图表之前已用数字记录，继承这些数字。
3. **`docs/requirements.md` 示例数据** → 如果需求指定了示例值，使用它们。
4. **工程存根，视觉上匹配 Figma 渲染** → 测量分段像素宽度（堆叠图）或相对高度（条形图/柱形图）并合成为 100%（百分比变体）或匹配可见比例（绝对值变体）的值。
5. 在 `__fixture_source__` 字段中记录解析选择，以便验证者区分"从设计中提取"与"工程匹配视觉"。

如果设计使用模板令牌，还应在 `__figma_template__` 字段中逐字记录它们。这使验证者能够比较两种表示 — 例如，"设计显示 `{num}%` 占位符，夹具提供 `27%`，构建的 UI 显示 `27%`" 是 MATCH，不是偏差。

**标签（分类名称、系列名称、图例项）必须始终从 Figma 逐字提取** — 绝不替换。仅数值通过上述解析顺序回退。

```json
{
  "__source__": "{Figma 节点 URL 或图片文件 + 节点 ID}",
  "__extracted_via__": "{Figma MCP get_design_context | visual analysis}",
  "__extracted_date__": "{YYYY-MM-DD}",

  "categories": ["{来自设计的精确标签 1}", "{精确标签 2}", "..."],
  "series": [
    {
      "name": "{精确系列名称}",
      "values": [{精确值 1}, {精确值 2}, ...]
    }
  ],

  "center_value": "{环形图中心显示的精确值（如适用）}",
  "center_sublabel": "{精确子标签（如适用）}",
  "percentages_shown": [{30}, {21}, {20}, {15}, {14}],

  "__fixture_source__": "{extracted-from-figma | inherited-from-flat-contract | requirements-sample | engineered-to-match-visual}",
  "__figma_template__": "{如果设计使用令牌：逐字记录，例如 '{num}%'。如果设计有具体值则省略。}"
}
```

**验证规则**: 当组件**使用此夹具**渲染时，构建 UI 中显示的每个标签、每个值、每个百分比必须与设计匹配。任何替换都是 DEVIATION。

### 验证工具包（如何孤立地渲染元素）

构建元素进行验证时，在专用的 `/design-system/{element-name}` 路由上渲染，仅包含与 Figma 并排比较所需的视觉上下文：

- **始终包含**: 元素本身、其数据标签、其图例（如果由元素拥有）。
- **如果 Figma 参考显示元素相邻**: 卡片外壳（标题、副标题、KPI 头部） — 但在页面包装器中标记为 `<!-- harness-only: belongs to widget contract -->`，以便未来读者不将其误认为此元素合同的一部分。
- **绝不包含**: 组件级控件（下拉菜单、日期选择器、头部操作按钮）、周围页面布局、导航、过滤器。

经验法则：如果从工具包中移除一个元素会使 Figma↔构建比较不可能（例如，无法知道 KPI "2.4" 指的是哪个图表），保留它。如果它只是使页面看起来像真实应用，剥离它。

## 响应式行为

| 断点 | 适应                                                     |
|------------|---------------------------------------------------------------|
| 移动端     | {例如，标签隐藏，点击显示工具提示}                        |
| 平板     | {例如，标签字号减小到 tokens.font.size.xs}        |
| 桌面端    | 完整的规格如上所示                                    |

## 无障碍

- **角色**: {例如，`img` 带描述性 aria-label，或 `figure` 带 `<figcaption>`}
- **键盘**: {例如，可聚焦，箭头键在分段之间导航}
- **屏幕阅读器**: {例如，在聚焦时宣布分类、系列、数值}
- **对比度**: {标签文本对比度 ≥4.5:1 对比分段填充}

## 实现备注

- **库**: {例如，Plotly.js / Recharts / D3 / 原生 SVG}
- **组件路径**: {src/components/charts/BarStackedHorizontal.vue}
- **依赖**: {所需包列表}

## 验证清单

设计验证代理使用此列表。每个项目必须解析为 ✅ MATCH 或 ❌ DEVIATION（附带具体值）— 绝不可是"看起来接近"或"似乎匹配"。

- [ ] {视觉规格属性 1 匹配设计}
- [ ] {视觉规格属性 2 匹配设计}
- [ ] 标签位置/字体/颜色匹配设计
- [ ] 颜色序列匹配设计令牌
- [ ] 悬停状态按指定变化
- [ ] 焦点状态可见且正确
- [ ] 响应式适应在正确断点触发
- [ ] 无障碍属性正确存在

## 示例

**被组件使用**: {列出引用此元素的组件合同}
**被页面使用**: {列出直接引用此元素的页面合同}
