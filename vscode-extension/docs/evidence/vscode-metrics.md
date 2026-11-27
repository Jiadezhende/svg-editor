# VS Code 扩展源码指标

基线提交 `3f0f5a96ac3f6e1ea7438f7d3f893e76174d7c61`，目标 `WORKTREE`。

统计 `vscode-extension/src` 的扩展运行源码，不含测试、构建产物和 CLI 源码。行数按物理行统计，圈复杂度口径与 CLI 报告一致。

| 分类 | 文件基线 | 文件目标 | 行数基线 | 行数目标 | 行数增量 | 复杂度基线 | 复杂度目标 | 复杂度增量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 入口 | 0 | 1 | 0 | 21 | 21 | 0 | 3 | 3 |
| 文件标记 | 0 | 1 | 0 | 25 | 25 | 0 | 7 | 7 |
| 大纲 | 0 | 3 | 0 | 320 | 320 | 0 | 98 | 98 |
| 路径判断 | 0 | 1 | 0 | 6 | 6 | 0 | 2 | 2 |

## 文件与职责

| 路径 | 分类 | 行数基线 → 目标 | 复杂度基线 → 目标 |
| --- | --- | ---: | ---: |
| `vscode-extension/src/SvgPath.ts` | 路径判断 | – → 6 | – → 2 |
| `vscode-extension/src/decoration/SvgFileDecorationProvider.ts` | 文件标记 | – → 25 | – → 7 |
| `vscode-extension/src/extension.ts` | 入口 | – → 21 | – → 3 |
| `vscode-extension/src/outline/SvgDocumentSymbolProvider.ts` | 大纲 | – → 42 | – → 9 |
| `vscode-extension/src/outline/SvgElementNode.ts` | 大纲 | – → 48 | – → 11 |
| `vscode-extension/src/outline/SvgSourceParser.ts` | 大纲 | – → 230 | – → 78 |
