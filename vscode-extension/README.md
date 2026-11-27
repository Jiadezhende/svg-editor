# SVG Editor for VS Code

Phase 2 第一部分的独立 VS Code 扩展：Explorer 给 `.svg` 文件显示 `[]`，原生 Outline 展示 SVG 元素层级并支持源码定位。

扩展是独立产品，不引用 `cli/src/`、`cli/plugins/`，也不修改文件内容。

## 快速开始

要求 VS Code 1.90 或更新版本，Node.js 22。

```bash
npm install
npm run typecheck
npm test
npm run build
```

在 VS Code 中打开本目录，按 F5 运行 `Run SVG VS Code Extension`；启动配置会构建扩展并打开 `samples/workspace`。也可以从仓库根目录执行：

```bash
code --extensionDevelopmentPath=vscode-extension vscode-extension/samples/workspace
```

## 目录

```text
src/extension.ts                         activate/deactivate 与 provider 注册
src/SvgPath.ts                           `.svg` 路径判断
src/decoration/                          Explorer 文件标记
src/outline/                             大纲解析与 DocumentSymbol 适配
test/                                    单元测试与 vscode API 替身
samples/workspace/                       示例 SVG、普通文件和同名目录
scripts/vscode-metrics.mjs               独立的 VS Code 源码指标
```

## 文档

- [架构与设计](docs/architecture.md)：包边界、运行时流程、provider、解析器、设计模式、Phase 1 复用评估。
- [验收与证据](docs/acceptance.md)：A.1/A.2/A.3 结果、测试与构建、截图和指标索引。
- [VS Code 源码指标](docs/evidence/vscode-metrics.md)：扩展独立的行数和圈复杂度报告。
- [实现提案](../doc/update/20261127_FEAT_VSCODE_EXTENSION.md)：决策记录与完成记录。

## 测试与指标

```bash
npm test
npm run metrics          # final → HEAD
npm run metrics:worktree # 未提交时预览工作区
```

`npm run metrics` 写出 `docs/evidence/vscode-metrics.md`；指标只统计 `src/` 运行代码，不含测试和构建产物。
