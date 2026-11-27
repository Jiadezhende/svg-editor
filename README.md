# SVG Editor

TypeScript 实现的 SVG 编辑器，仓库按产品拆分为两个独立项目：

| 目录 | 内容 | 入口 |
| --- | --- | --- |
| [`cli/`](cli/README.md) | 命令行 SVG 编辑器：内核、插件、配置、测试与回放样例 | `cli/src/main.ts` |
| [`vscode-extension/`](vscode-extension/README.md) | VS Code 扩展：Explorer 文件标记与 SVG Outline | `vscode-extension/src/extension.ts` |
| [`doc/`](doc/README.md) | 课程交付文档：背景、验收、过程记录与文档索引 | `doc/README.md` |
| `refs/` | 课程任务书与参考资料 | – |

两个项目各自安装依赖、各自运行测试，源码互不引用。CLI 的配置、插件和测试全部位于 `cli/` 下。

## 快速开始

```bash
cd cli
npm install
npm test
npm run typecheck
npm run cli -- --config plugins.config.json
```

```bash
cd vscode-extension
npm install
npm test
npm run typecheck
npm run build
```

CLI 的架构与验收说明见 [doc/README.md](doc/README.md)，详细架构见 [cli/docs/architecture.md](cli/docs/architecture.md)，插件编写见 [cli/docs/plugins.md](cli/docs/plugins.md)，完整验收资料见 [cli/docs/acceptance.md](cli/docs/acceptance.md)。

## 文档结构

README 只保留仓库入口和 CLI 入口两级；CLI 的详细文档集中在 `cli/docs/`：

| 入口 | 内容 |
| --- | --- |
| [README.md](README.md) | 仓库总览、两个产品的快速开始 |
| [doc/README.md](doc/README.md) | 课程交付文档：项目背景、运行、验收证据、过程记录与一致性自查 |
| [cli/README.md](cli/README.md) | CLI 安装、运行、配置、验证，以及 `cli/docs/` 索引 |
| [cli/docs/architecture.md](cli/docs/architecture.md) | CLI 详细架构 |
| [cli/docs/acceptance.md](cli/docs/acceptance.md) | CLI 验收结果、检查点、证据与回放样例 |
| [cli/docs/plugins.md](cli/docs/plugins.md) | 插件包与贡献声明 |
| [vscode-extension/README.md](vscode-extension/README.md) | VS Code 扩展的安装、运行与结构 |

## 分支与基线

Phase 1 基线是 `final` 标签，其源码位于当时的仓库根目录；当前 `cli/` 布局是 Phase 2 之后的产品拆分。
