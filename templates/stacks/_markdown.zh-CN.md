# Markdown 表格标准（通用 — 所有项目）

这些规则是 **强制** 的。违规导致任务失败。没有例外。

---

## Markdown 表格中的 Emoji 填充

Emoji 在终端/等宽字体中显示为 2 个字符宽，但在字符串长度中计为 1。这会导致列错位。**始终在表格单元格中的 emoji 后添加一个额外空格** 来补偿:

```
错误 — 在终端中错位:
| Channel  | Support |
|----------|---------|
| Discord  | ✅ |
| LINE     | ❌ |

正确 — emoji 后多一个空格:
| Channel  | Support |
|----------|---------|
| Discord  | ✅  |
| LINE     | ❌  |
```

这个额外空格在渲染的 HTML（GitHub、VS Code 预览）中不可见，但在终端视图中恢复对齐。适用于所有使用 emoji 的 GSD-T 生成的文档中的表格。

同时将列中的所有单元格值填充到最宽值的宽度:
```
| iMessage (BlueBubbles) | ✅  |
| Discord                | ✅  |
| QQ                     | ❌  |
```
