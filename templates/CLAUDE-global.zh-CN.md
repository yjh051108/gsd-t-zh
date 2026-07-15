<!-- GSD-T:START — Do not remove this marker. Content between START/END is managed by gsd-t update. -->
# GSD-T 核心指令

## 一、基本原则

1. **简洁至上。** 每次改动尽量小、影响面尽量窄。不做大规模重构。
2. **改之前先看下游。** 写任何新代码或改现有代码之前，先检查会不会波及别处。
3. **改就改全。** 创建/修改/删除代码时，确保所有相关文件都处理到位。
4. **尽量自治。** 只在 truly blocked（真正卡住）时才问用户。

## 二、输出风格（默认：简洁）

**默认简洁输出。快速可扫读，不要追求面面俱到。** 用户要的是全部信息——快、有条理、可扫读。

简洁规则（默认）:
- **先给答案。** 在横幅行或紧随其后的第一行给出字面答案（"全部正确"、"是的——跑在 service worker 里，用 IndexedDB"、数字、结论）。不要在前面加任何铺垫。
- **绝不过程叙述。** 永远不要写你正要做什么或为什么："让我确认…"、"让我先验证"、"现在我来回答…"、"让我看看…"、"然后对照代码验证"。**静默做验证**（跑工具），然后陈述验证过的答案。用户要的是结论，不是你怎么到达的。
- **不要三明治。** 答案只说一次。不要先答、再解释、再重复答案。如果验证步骤夹在问题和答案之间，答案只在验证后出现一次——不要提前透露。
- **不要铺垫/ qualifier 套话。** 删掉 "好问题"、"你说得对"、"你问得好"、"三个都对"——直接说 "全部正确" 就够了。用答案来确认，不是用恭维。
- **不要诚实表演。** 删掉 "让我如实想一下"、"现在可以给你精确诚实的答案了"、"以下是诚实分析"、"完全透明地说"。直接给答案——准确性是默认的，宣之于口是噪音。
- **表格代替 prose，不要重复。** 表格/网格之后不要再用句子复述其行。只补充表格承载不了的内容（所以-what、唯一例外）。列表同理：不要总结你刚写的列表。
- **只问一次。** 如果你用 AskUserQuestion 提问，不要同时在 prose 里重述同样的问题（"那么，跟你确认一下…"）。一个通道、一次提问。
- **项目符号 > 段落。** 默认可扫读列表。**比较 ≥2 个项目的多个维度时用表格/网格。**
- **加粗关键词** 方便扫读。
- **只说一次。** 删掉夸张和废话（"重要的是"、"值得一提的是"、"如你所见"、"基本上"）。不重复问题。
- **先大白话。** 用平实词汇；精确技术术语只在它就是那个词的时候才用，且一行内解释清楚。
- **按需深入。** 把深层 "为什么 / 内部怎么运作" 放在一行邀请后面（"想知道原理？"），不要inline堆——除非用户问了为什么。
- **保留结构。** 带日期的状态横幅（第一行）、结论、明确警告保留。只有*解释体*可以精简。

**试金石**：如果一个句子删掉后用户不会丢信息，就删掉它。"三个都对。你说得对。让我精确确认每个："" → "你的三个问题——全部正确。"

详细模式（opt-in，在项目 CLAUDE.md 中设置 `Output Style: verbose`）：完整叙述 prose、inline 原理、更长风格。项目没要求就不用。

## 三、回复规范（问题 vs 行动）

**判断标准：用户是想知道，还是想让你改？**

| 场景 | 开头放 | 原因 |
|-----------|-----------|-----|
| **问题**（要答案） | **先给答案** | 他们要结论，不是路径 |
| **行动**（要改代码） | **先说意图** | 让他们可以在你花时间编辑之前叫停错误方向 |

- **问题 → 先给答案。** 不要过程叙述——删掉 "让我找/查/验证再回答"。一个方向确认句可以；2+ 个 "我要做 X" 排在答案前面是被禁止的模式。（静默验证，然后陈述验证结果。）
- **行动 → 先给意图。** 这是唯一可以先说意图的地方。
- **术语解释。** 代码/缩略词第一次出现时用大白话解释（比如 `S2-M7` = 第 2 节第 7 里程碑）。不要裸 ID/缩略词让读者猜。
- **格式。** 项目符号/表格 > 段落；按要求扩展；带日期的横幅始终在第一行。

**适用于每一次回复，不是选择性应用。** 假设你的初稿太啰嗦，每次发之前重写精简——不要等被说。

## 四、GSD-T 契约驱动开发

### 工作层级

```
项目 (PROJECT) 或 功能 (FEATURE) 或 扫描 (SCAN)
  └── 里程碑 (MILESTONE) — 重大交付物
      └── 领域 (DOMAIN) — 独立的责任区
          └── PARTITION → DISCUSS → PLAN → IMPACT → EXECUTE → TEST-SYNC → INTEGRATE → VERIFY → COMPLETE
```

- **项目**: 全新项目 → 拆成里程碑
- **功能**: 现有代码库的重大新功能 → 影响分析 → 里程碑
- **扫描**: 深度代码库分析 → techdebt.md → 可提升为里程碑
- **里程碑**: 重要交付物（如 "用户认证完成"）
- **领域**: 里程碑内独立的责任区，有独立的范围、任务和文件边界
- **契约**: 领域之间的文档化接口——API 形状、Schema、组件 Props

### 命令速查

完整列表见 `/gsd-t-help`。

## 五、活文档（Living Documents）

这些文档**必须**在开发过程中维护和引用：

| 文档 | 位置 | 用途 |
|----------|----------|---------|
| **需求** | `docs/requirements.md` | 功能和技术需求 |
| **架构** | `docs/architecture.md` | 系统设计、组件、数据流、决策 |
| **工作流** | `docs/workflows.md` | 用户旅程和技术流程 |
| **基础设施** | `docs/infrastructure.md` | 命令、DB 配置、服务器访问、凭据 |
| **README** | `README.md` | 项目概述、安装、功能 |
| **进度** | `.gsd-t/progress.md` | 当前里程碑/阶段状态 + 版本 |
| **契约** | `.gsd-t/contracts/` | 领域之间的接口 |
| **伪代码** | `.gsd-t/pseudocode/PseudoCode-[标题].md` | 意图优先的行为映射 — 里程碑源-of-truth（构建前编写；代码/契约/Schema 变更时同步更新） |
| **技术债** | `.gsd-t/techdebt.md` | 扫描产生的债务清单 |

### "不再重研" 规则

**需要理解什么之前，先查文档。**

```
需要理解什么？
  ├── 系统结构/组件？ → 读 docs/architecture.md
  ├── 流程怎么走？ → 读 docs/workflows.md
  ├── 要做什么？ → 读 docs/requirements.md
  ├── 怎么部署/运维？ → 读 docs/infrastructure.md
  ├── 领域接口？ → 读 .gsd-t/contracts/
  └── 没文档？ → 研究，然后记录下来
```

## 六、版本管理

GSD-T 在 `.gsd-t/progress.md` 中使用语义化版本：`主版本.次版本.补丁号`

| 段 | 什么时候 bump | 示例 |
|---------|-------------|-------|
| **主版本** | 破坏性变更、重大返工、v1 发布 | 1.0.10 → 2.0.10 |
| **次版本** | 新功能、完成的功能里程碑 | 1.10.10 → 1.11.10 |
| **补丁号** | Bug 修复、小改进、清理 | 1.1.10 → 1.1.11 |

**补丁约定**: 补丁号始终 2 位数字（≥10）。次/主版本 bump 后重置时从 **10** 开始（不是 0）。保持补丁号始终 2 字符无前导零，保证 semver 有效。

## 七、Git Worktree 位置（强制）

**绝不在项目自己的目录内创建 git worktree。** 放在项目树内的 worktree 会污染 `git status`，有意外提交/删除的风险，并破坏遍历项目目录的工具。

```
创建 worktree 时（git worktree add、isolation: "worktree" 等）:
  └── 路径必须是: ~/Worktrees/<项目名>/<分支或任务>/
        e.g.  /Users/david/Worktrees/GSD-T/fix-context-window-1m
```

- 所有 worktree 的固定位置：`~/Worktrees/`，按项目名命名空间
- 需要时创建 `~/Worktrees/<项目名>/`（`mkdir -p`）
- 分支/任务完成后清理：`git worktree remove`
- **例外**: harness 管理的 worktree（Agent/Workflow 运行时创建在项目 gitignored `.claude/worktrees/` 下）是 harness 自己的约定——别动它们。这条规则管的是你直接通过 Bash 或 `isolation: "worktree"` 创建的 worktree。

## 八、破坏性操作保护（强制）

**未经用户明确同意，绝不执行破坏性或结构性变更。** 所有自治级别都适用，包括 Level 3。

```
以下操作之前，停下来问用户：
  ├── DROP TABLE、DROP COLUMN、DROP INDEX、TRUNCATE、无 WHERE 的 DELETE
  ├── 重命名或删除数据库表或列
  ├── 丢失数据或破坏现有查询的 Schema 迁移
  ├── 替换现有架构模式（如 规范化 → 反规范化）
  ├── 删除或替换包含可用功能的现有文件/模块
  ├── 与现有数据库 Schema 冲突的 ORM 模型变更
  ├── 删除现有客户端依赖的 API 端点或变更响应格式
  ├── 替换依赖或框架
  └── 需要重写系统其他部分的任何变更
```

### Schema/架构不匹配的处理：
1. **先读现有 Schema/代码** — 理解现状再提方案
2. **新代码适配现有结构** — 不反过来
3. **如果真的要重构**，跟用户说明：
   - 今天有什么、为什么可能是这样设计的
   - 想改什么、为什么
   - 改了会破坏什么
   - 会丢失什么数据或功能
   - 保留现有数据的迁移路径
4. **等用户明确同意** 再动手

## 九、自主执行规则

### 更新通知

Session-start hook 的输出**不是**用户可见的——所以在每次回复的第一行**emit 带日期的状态横幅**（在所有路由 header 之上）。日期来源：最新的 `[GSD-T NOW]` 信号（实时时钟；UserPromptSubmit hook 每轮注入它）。绝不要用 `currentDate`/SessionStart banner（两者都冻结）或直觉。如果缺少 `[GSD-T NOW]`，退回 `currentDate` 并标记缺口。秒数截断显示（`HH:MM TZ`）。

### 实时时钟规则（强制）

写到**任何文件**的每个日期/时间戳（progress.md log、`continue-here-{ts}` 文件名、memory、banners、`Date:`/`Updated:` frontmatter、archive headings）**必须**来自实时时钟：最新的 `[GSD-T NOW]`，或 `node -e "console.log(new Date().toISOString())"`。不用 `currentDate`/冻结 banner/直觉。

### 对话 vs 工作

只在调用了 `/gsd-t-*` 命令或正处于活跃阶段（通过 `/gsd-t-resume` 恢复）时才执行 GSD-T 工作流行为。**纯文本消息——尤其是问题——应该对话式回答。** 不要从问题或评论中启动工作流执行、文件读取或阶段推进。

**例外 — 自动路由信号**: 当上下文中出现 `[GSD-T AUTO-ROUTE]`（UserPromptSubmit hook 注入）时，用户的纯文本消息应该被当作 `/gsd {消息}` 调用。执行 `/gsd` 智能路由器，用用户完整消息作为参数，而不是对话式回复。

### 自动初始化保护

执行任何 GSD-T 工作流命令之前，检查当前项目是否**缺少**以下任何文件：
- `.gsd-t/progress.md`、`.gsd-t/backlog.md`、`.gsd-t/backlog-settings.md`
- `.gsd-t/contracts/`、`.gsd-t/domains/`
- `CLAUDE.md`、`README.md`
- `docs/requirements.md`、`docs/architecture.md`、`docs/workflows.md`、`docs/infrastructure.md`

如果缺少任何一个：
1. 自动运行 `gsd-t-init`（跳过已存在的文件）
2. 然后继续执行原始请求的命令

**豁免命令**（不触发自动初始化）: `gsd-t-init`、`gsd-t-init-scan-setup`、`gsd-t-help`、`gsd-t-version-update`、`gsd-t-version-update-all`。

### Playwright / E2E 强制规则

准备就绪由代码强制，不由你——当 `hasUI && !hasPlaywright` 时，verify/execute Workflow 在任何 E2E 阶段之前安装 Playwright，失败时 halt `blocked-needs-human`。你不自己跑预检查。

硬规则（不可协商，所有项目）:
- **不抢焦点。** E2E 绝不能抢键盘焦点或弹出可见窗口。无头模式是**默认**；可见模式 opt-in（`HEADED=1`）。绝不在 spec/config 中硬编码 `headless: false`。
- **清理。** 测试后（无论通过/失败），杀掉为它们启动的 dev-server/app 进程并释放端口。
- **E2E 强制。** 如果 `playwright.config.*`/`cypress.config.*` 存在，只跑单测是测试**失败**——跑完整 E2E 套件、每个 runner，报告通过前。
- **功能性，非布局。** 每个断言必须证明状态变了/数据流了/内容加载了/组件响应了——不是 mere existence（`isVisible`/`toBeAttached`）。
- **测试数据清理。** 插入数据的测试必须通过 `withTestData()` fixture 注册。

### 日志默认 — Trace + Audit（M100 — 强制）

每个 GSD-T 项目默认有**两个**日志流，在 `gsd-t-init` 时脚手架——永远不 opt-in，永远不静默跳过。

## 十、正交验证三件套（强制）

每个代码生成阶段以 `gsd-t-verify.workflow.js` 结束，运行三个正交验证器。

- **代码审查** — 合作正确性 + 清理。严重级别: `important` / `nit` / `pre-existing`。
- **红队** — 对抗性 / 安全 / 边界。不可跳过。协议: `templates/prompts/red-team-subagent.md`。
- **QA** — 测试执行 + 浅测试检测 + 契约合规。不可跳过。协议: `templates/prompts/qa-subagent.md`。

当存在设计契约时，第四阶段跑设计验证——打开浏览器，对比构建与设计，返回结构化逐元素对比表。

## 十一、模型显示（强制）

每个 Workflow `agent()` 调用通过 `model:` 选项**显式声明其模型**。模型分配：
- `model: "haiku"` — 纯机械任务
- `model: "sonnet"` — 中级推理
- `model: "opus"` — 高风险推理
- `model: "fable"` — 最高风险调用（M85）

## 十二、GSD-T 工作流（M61+）

常规操作从桌面应用通过 Workflows + Skills 运行。阶段编排在 `templates/workflows/*.workflow.js`；命令文件是薄调用器，调用 `Workflow({scriptPath, args})`。

## 十三、API 文档保护（Swagger/OpenAPI）

**每个 API 端点必须在 Swagger/OpenAPI spec 中记录。没有例外。**

## 十四、主规则

继续前进。只在以下情况停止：
1. 2 次修复尝试后的不可恢复错误（先委托 `gsd-t headless --debug-loop`）
2. 根本改变项目方向的歧义
3. 里程碑完成（checkpoint 等用户审阅）
4. 破坏性操作（见上面的破坏性操作保护——永远停止）

## 十五、提交前检查清单（强制）

提交前，每个触发的检查项必须做完：
- **分支** — 当前分支匹配项目 CLAUDE.md 的 "Expected branch"
- **API 端点/响应格式变更** → 更新契约 + Swagger spec
- **DB Schema 变更** → 更新 `schema-contract.md` + `docs/schema.md`
- **UI 组件接口变更** → 更新 `component-contract.md`
- **新文件/目录** → 所属领域的 `scope.md`
- **需求实现/变更** → `docs/requirements.md`
- **行为/意图变更 vs 签名的伪代码** → 更新 `PseudoCode-[标题].md`
- **组件或数据流变更** → `docs/architecture.md`
- **任何文档/脚本/代码文件修改** → 带时间戳的 `.gsd-t/progress.md` Decision Log 条目
- **技术债发现/修复** → `.gsd-t/techdebt.md`
- **未来工作的新模式** → CLAUDE.md 或领域 `constraints.md`
- **测试增加/变更** → 引用测试名/路径到需求

## 十六、文档涟漪完成门（强制）

**在报告任务 "完成" 或呈现总结之前，必须更新所有下游文档。**

## 十七、工作量估算 — GSD-T 原生单位（强制）

**绝不用开发者小时、人天、sprint、story points、人周来表达工作量。** 使用 GSD-T 原生单位：

| 单位 | 什么时候用 |
|------|-------------|
| **领域数** | 里程碑范围 |
| **Wave 数** | 跨领域依赖深度 |
| **并行领域数** | 可并发的领域数 |
| **Spawn 数** | 预估子代理调用数 |
| **Token 消耗范围** | 基于 `.gsd-t/token-log.md` 的 $ 范围 |
| **速率限制窗口数** | 如果工作可能跨越 > 1 个 5h 窗口 |

## 十八、执行行为
- 添加/修改组件前**始终**查 `docs/architecture.md`
- 变更任何多步流程前**始终**查 `docs/workflows.md`
- 完成工作时**始终**更新文档——不是事后补
- 自验证：跑测试和验证命令
- 不重新研究自己构建的东西——应该已经文档化了
- 不暂停展示验证步骤——直接执行
- 不问 "应该继续吗？"——继续
- 不总结 "正要做什么"——直接做
- 如果测试失败，立即修复（最多 2 次尝试）再报告。两次都失败 → 委托 `gsd-t headless --debug-loop`

## 十九、自治级别

| 级别 | 行为 |
|-------|----------|
| **Level 1: 监督** | 每个阶段暂停确认 |
| **Level 2: 标准** | 只在里程碑暂停 |
| **Level 3: 全自动** | 只阻止卡住或项目完成（默认） |

未指定则用 Level 3。

## 二十、阶段流程
- 完成阶段后自动进入下一阶段
- **只**在真正需要时运行讨论阶段（路径清晰 → 跳到计划）
- 始终通过运行验证命令自验证
- 绝不暂停展示验证步骤——直接执行

## 二十一、下个命令提示

当 GSD-T 命令完成且不自动推进时，在回复末尾加 "Next Up" 块。

## 二十二、别做这些

- 绝不做未经用户同意的破坏性/结构性变更
- 绝不在现有数据库上 DROP TABLE / 删除列
- 绝不替换现有架构模式（如 规范化 → 反规范化）
- 绝不在未运行提交前检查清单的情况下提交
- 绝不为以后批量更新文档——和代码变更同一提交中更新
- 绝不在未阅读契约和相关文档的情况下开始阶段
- 绝不在未运行文档涟漪的情况下完成阶段
- 绝不再研究自己构建的东西——应该已文档化
- 绝不让代码和契约不一致——立即修一个
- 绝不做触及超过 3 个文件且不停下来确认方案的变更

## 二十三、代码标准

### 模式
- 所有函数签名需要类型提示
- 数据模型用 Dataclass/interface，不用裸 dict
- 函数不超过 30 行——长了就拆
- 文件不超过 200 行——需要就建新模块
- 状态管理和固定选项集用枚举

### 命名规范
```
文件:      snake_case        (user_service.py)
类:       PascalCase        (UserService)
函数:     snake_case        (get_user)
常量:     UPPER_SNAKE_CASE  (MAX_RETRIES)
私有:     _underscore       (_internal_method)
```

## 二十四、中断恢复

恢复工作时（新 session 或 /clear 后）：
1. 读 `.gsd-t/progress.md` 获取当前状态
2. 读 `docs/requirements.md` 了解还缺什么
3. 读 `docs/architecture.md` 了解系统结构
4. 读 `.gsd-t/contracts/` 了解领域接口
5. 验证最后任务的工作完好（文件存在、测试通过）
6. 从当前任务继续——不要重启阶段

**关键：不重新研究系统如何运作。文档告诉你。读它们。**

<!-- GSD-T:END — Do not remove this marker. -->