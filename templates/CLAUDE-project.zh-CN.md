# GSD-T 框架 (@tekyzinc/gsd-t)

核心指令、规则和流程在 `~/.claude/CLAUDE.md`。这个文件只覆盖本项目特有的内容。

## 项目概览

契约驱动的开发方法论，用于 Claude Code。npm 包提供斜杠命令、CLI 安装器、模板和堆栈规则，用于可靠的可并行 AI 辅助开发。

## 自治级别

> 覆盖全局：固定 `~/.claude/CLAUDE.md` 中 §自治级别 的默认值。

**Level 3 — 全自动**。只在阻塞、破坏性操作或项目完成时暂停。

## 技术栈

- **语言**: JavaScript（Node.js >= 16），安装器零外部运行时依赖
- **分发**: npm 包 `@tekyzinc/gsd-t`
- **CLI**: `bin/gsd-t.js`（安装、更新、初始化、状态、卸载、诊断等）
- **测试**: `npm test`（Node 内置测试运行器）+ 手动 CLI 测试

## 项目结构

```
bin/                     — CLI 入口 (gsd-t.js) + 编排器
commands/                — Claude Code 的斜杠命令（GSD-T 工作流 + 工具）
templates/               — 文档 + 提示词 + 堆栈模板
scripts/                 — 运行时脚本
docs/                    — 项目文档
.gsd-t/                  — GSD-T 状态目录
```

## 元项目备注

- "源码" 是 `commands/` + `templates/` 中的 `.md` 文件和 `bin/` + `scripts/` 中的 JS。没有 `src/`。
- 命令文件的变更等于方法论的变更——像代码一样对待它们；通过运行工作流验证。
- `.gsd-t/` 状态目录与定义它的命令共存——这是故意的。

## 约定

**CLI** — ANSI 颜色 via 转义码，零外部依赖，同步文件 API，版本追踪在 `package.json` 和 `~/.claude/.gsd-t-version`。

**命令文件** — 纯 markdown，无 frontmatter，接受 `$ARGUMENTS`，编号步骤，薄 Workflow 调用器。包含文档涟漪部分，列出底层 Workflow 期望领域工作者更新的文件。

**模板** — `{项目名}`、`{日期}`、`{描述}` 替换 token；结构化数据用表格。

## 工作流（M61 — v4.0.10+）

阶段编排在 `templates/workflows/`。每个命令文件是薄调用器，调用 `Workflow({scriptPath, args})`。

## 验证协议

三个验证协议体在 `templates/prompts/`:
- `qa-subagent.md` — 测试机制 + 浅测试检测 + 契约合规
- `red-team-subagent.md` — 对抗性 / 安全 / 边界
- `design-verify-subagent.md` — 视觉对比设计契约

## 破坏性操作保护（强制）

和全局 CLAUDE.md 中相同。项目级附加规则见上方全局文件。

## 提交前检查清单（项目级附加）

全局检查清单之外，本项目还有：
- **命令文件接口/行为变更** → 更新所有参考文件
- **新增/删除命令** → 更新所有 4 个参考文件，bump `package.json`
- **新建命令调用 Workflow** → 验证 `scriptPath` 解析正确
- **CLI 安装器变更** → 冒烟测试
- **模板变更** → 验证 `gsd-t-init` 输出正确

## 别做的事

- 绝不给安装器加外部 npm 运行时依赖——零依赖不变式
- 绝不重命名命令不更新所有 4 个参考文件
- 绝不改 wave 阶段序列不更新 wave、README、GSD-T-README
- 绝不内联验证子代理协议体到 Workflow 脚本

## 恢复中断

1. 读 `.gsd-t/progress.md`
2. 读 `README.md` 了解包交付什么
3. 查 `commands/` 和 `package.json` 了解当前状态
4. 从当前任务继续；不重启阶段

## 当前状态

见 `.gsd-t/progress.md`。
