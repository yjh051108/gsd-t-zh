# GSD-T 中文适配版 (gsd-t-zh)

**v5.1.13-zh** — 基于 [GSD-T v5.1.13](https://github.com/Tekyz-Inc/get-stuff-done-teams) 的中文化适配版，支持 54 个中文 slash 命令 + 第三方模型兼容（Stepfun 代理等）。

## 核心特性

- **全中文界面** — 54 个命令模板 + CLI 输出均已中文化（zh-CN locale）
- **第三方模型兼容** — 通过环境变量 `GSD_T_MODEL_OPUS/FABLE/SONNET/HAIKU` 自由映射模型层级到任意提供方（Stepfun / OpenAI / Groq / 本地模型等）
- **Stepfun 代理就绪** — 开箱即用 `step-3.7-flash` 作为默认模型
- **上下文仪表盘代理兼容** — 自动检测 `ANTHROPIC_BASE_URL` 和自定义 modelId

## 快速开始

### 通过 npm 安装

```bash
npm install -g gsd-t-zh
```

或直接运行：

```bash
npx gsd-t-zh install
```

这会安装 54 个 GSD-T 中文工作流命令 + 5 个工具命令到 `~/.claude/commands/`，并将全局 CLAUDE.md 安装到 `~/.claude/CLAUDE.md`。支持 Windows、Mac 和 Linux。

### 配置中文 Locale

在 Claude Code 的 `settings.json` 中添加：

```json
{
  "env": {
    "GSD_T_LOCALE": "zh-CN"
  }
}
```

或设置环境变量：

```bash
# Windows (PowerShell)
$env:GSD_T_LOCALE = "zh-CN"

# Mac/Linux
export GSD_T_LOCALE=zh-CN
```

### 配置第三方模型（如 Stepfun）

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.stepfun.com/step_plan",
    "ANTHROPIC_AUTH_TOKEN": "your-token",
    "ANTHROPIC_MODEL": "step-3.7-flash",
    "CLAUDE_CODE_SUBAGENT_MODEL": "step-3.7-flash",
    "GSD_T_MODEL_OPUS": "step-3.7-flash",
    "GSD_T_MODEL_FABLE": "step-3.7-flash",
    "GSD_T_MODEL_SONNET": "step-3.7-flash",
    "GSD_T_MODEL_HAIKU": "step-3.7-flash"
  }
}
```

每个 `GSD_T_MODEL_*` 环境变量独立控制对应层级，未设置时默认 `step-3.7-flash`。也可映射到不同模型（如 `GSD_T_MODEL_FABLE=my-custom-model`）。

### 开始使用

```bash
# 1. 在你的项目中启动 Claude Code
cd my-project
claude

# 2. 完整初始化（git + init + scan + setup 一步完成）
/gsd-t-init-scan-setup

# 或逐步初始化：
/gsd-t-init my-project

# 3. 定义你要构建的内容
/gsd-t-milestone "用户认证系统"

# 4. 全速运行（自动推进所有阶段）
/gsd-t-wave

# 或逐阶段控制：
/gsd-t-partition
/gsd-t-discuss
/gsd-t-plan
/gsd-t-impact
/gsd-t-execute
/gsd-t-test-sync
/gsd-t-integrate
/gsd-t-verify
/gsd-t-complete-milestone
```

### 恢复中断的工作

```bash
claude
/gsd-t-resume
```

GSD-T 会读取所有状态文件并告诉你上次停在哪里。

---

## CLI 命令

```bash
gsd-t-zh install        # 安装命令 + 全局 CLAUDE.md (54 个命令)
gsd-t-zh update         # 更新全局命令 + CLAUDE.md
gsd-t-zh update-all     # 更新全局 + 所有注册项目的 CLAUDE.md
gsd-t-zh init [name]    # 初始化 GSD-T 项目（自动注册）
gsd-t-zh register       # 注册当前目录为 GSD-T 项目
gsd-t-zh status         # 检查安装 + 版本
gsd-t-zh doctor         # 诊断常见问题
gsd-t-zh changelog      # 在浏览器中打开变更日志
gsd-t-zh uninstall      # 移除命令（保留项目文件）
gsd-t-zh setup-playwright [path]  # 为项目安装 Playwright + chromium
```

---

## 与原版的区别

| 特性 | GSD-T (原版) | gsd-t-zh (中文版) |
|------|-------------|-------------------|
| 命令模板 | 英文 `.md` | 中文 `.zh-CN.md` |
| CLI 输出 | 英文 | 中文（通过 I18N 翻译层） |
| 模型配置 | 仅 Claude 系列 | 任意模型（通过环境变量） |
| Locale 选择 | 无 | `GSD_T_LOCALE` env var / settings.json |
| 包名 | `@tekyzinc/gsd-t` | `gsd-t-zh` |

---

## 与原版的关系

本包基于 [Tekyz-Inc/get-stuff-done-teams](https://github.com/Tekyz-Inc/get-stuff-done-teams) v5.1.13，遵循相同的开发方法论。核心工作流、架构和测试套件完全一致，仅增加：

1. **中文本地化层** — `getLocale()` + `I18N` 翻译对象 + `.zh-CN.md` 模板文件
2. **模型适配层** — `GSD_T_MODEL_*` 环境变量覆盖（`bin/gsd-t-model-tier-policy.cjs`）

---

## 工作流阶段

| 阶段 | 目的 | 单人/团队 |
|------|------|----------|
| **Milestone** | 定义交付物 | 单人 |
| **Partition** | 分解为领域 + 合同 | 单人 |
| **Plan** | 创建原子任务列表 | 单人 |
| **Impact** | 下游影响分析 | 单人 |
| **Execute** | 构建 — 领域工作器并行运行（文件互斥门控） | 两者 |
| **Test-Sync** | 保持测试覆盖率 | 单人 |
| **Integrate** | 连接领域 | 单人 |
| **Verify** | 质量门控 | 两者 |
| **Complete** | 归档 + 标签 | 单人 |

---

## 模型配置文件

M86 增加每个项目的 **层级花费开关**。三个命名配置：

| 配置文件 | Fable 阶段 | 适用场景 |
|---------|------------|---------|
| `standard` | 无 — M85 前姿势 | CI 运行、草稿里程碑、预算紧张 |
| `pro` | red-team + pre-mortem + debug-cycle-2 | 生产级里程碑 |
| `premium` | 全部 6 个 M85 阶段（默认） | 最高质量门控 |

---

## 日志系统（Trace + Audit，M100 — 强制默认）

每个 GSD-T 项目默认自带 **两条日志流**（`gsd-t-init` 时脚手架，`gsd-t-verify` 时强制检查）：

| 日志流 | 定义 | 默认规则 | 豁免方式 |
|--------|------|----------|----------|
| **Trace** (trace) | 瞬态、PII 过滤、可开关的**调试信号流** | 所有项目默认 (default) 开启 — 不可静默跳过 | 无状态 CLI/库可在 `.gsd-t/trace-optout.json` 记录豁免原因 |
| **Audit** (audit) | 持久、仅追加、管理员可查询的**问责记录** | 所有项目默认 (default) 开启 — 不可静默跳过 | 在项目 `CLAUDE.md` 中声明豁免，或写 `.gsd-t/audit-optout.json` |

- **存储后端** — 自动检测技术栈，展示真实选项，**人工审批后才选择**（Level 3 全自动的唯一 sanctioned pause）
- **Trace 与 Audit 永不合并** — 两条流的 envelope 结构不同，合并即违反契约
- **迁移** — 已有项目运行 `gsd-t migrate-logging` 增量添加，不修改现有文件

Opt-out 机制：trace 写 `.gsd-t/trace-optout.json`，audit 写 `.gsd-t/audit-optout.json` 或在项目 CLAUDE.md 声明。相关契约：`trace-logging-contract.md`、`audit-logging-contract.md`

---

## 安全

- **Wave 模式** 使用 `bypassPermissions` 生成阶段代理 — 代理无需每次操作的用户批准。敏感项目使用 Level 1 或 Level 2 自主权以审查每个阶段。
- **心跳日志** 从 bash 命令中清除敏感模式（密码、令牌、API 密钥）并在写入 `.gsd-t/heartbeat-*.jsonl` 之前屏蔽 URL 查询参数。
- **文件写入路径** 在写入之前经过验证（在 `~/.claude/` 内）并检查符号链接。
- 运行 `gsd-t-zh doctor` 验证安装完整性。

---

## 开源许可

MIT — 与原始 GSD-T 相同

---

## 链接

- **GitHub**: https://github.com/yjh051108/gsd-t-zh
- **原版 GSD-T**: https://github.com/Tekyz-Inc/get-stuff-done-teams
- **npm**: https://www.npmjs.com/package/gsd-t-zh
