# REFACT：CLI 独立到 cli/ 目录

- 提案时间：2026-11-27
- 完成时间：2026-11-27
- 类型：REFACT
- 关联 prd：doc/prd/phase2/20261125_PHASE2_DELIVERY.md

## 动因

VS Code 扩展作为独立产品进入仓库后，CLI 的源码、插件、测试、配置、依赖和开发脚本仍与扩展、文档混在根目录。根目录既是 CLI 的 npm 包，又承载扩展和课程文档，导致：

- 无法从目录判断哪些文件属于 CLI，哪些属于 VS Code 扩展；
- CLI 的 `package.json`、`tsconfig.json`、`vitest.config.ts` 与扩展的构建、测试配置处于同一层；
- 根目录的 `scripts/vscode-metrics.mjs` 已不存在，`metrics:vscode` 与 `vscode:*` 转发脚本却仍留在 CLI 包中；
- 回放样例、CLI 测试和 CLI 源码分散在 `doc/transcript`、`test/`、`src/`，不便于把 CLI 作为一个自包含产品交付。

目标：把 CLI 的能力（配置、源码、插件实现、测试、回放样例、依赖与脚本）全部收进 `cli/`，根目录只保留跨产品文档、参考资料、VS Code 扩展和仓库级配置。CLI 与扩展各自安装依赖、各自测试，源码互不引用。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 仓库形态 | 根目录保留 CLI 配置 / 全部迁入 `cli/` | `cli/` 自成独立 npm 项目，根目录不再有 `package.json` 与 `node_modules` | 目录边界即产品边界；避免出现两套 CLI 配置 |
| 依赖位置 | 共用根 `node_modules` / 随 CLI 包 | `package-lock.json`、`node_modules` 随 `cli/`，`npm install` 在 `cli/` 执行 | 全新检出时可以只安装 CLI，不携带扩展依赖 |
| 回放样例 | 保留 `doc/transcript/` / 随 CLI 测试 | 迁入 `cli/test/fixtures/transcript/` | 输入、期望输出和 SVG 样例是 CLI 测试数据，不是文档正文 |
| 根便利脚本 | 保留 `vscode:*` 与 `metrics:vscode` 转发 / 删除 | 删除 | VS Code 已有自己的 `build`、`typecheck`、`test`、`metrics` 脚本；原 `metrics:vscode` 指向不存在的文件 |
| 文档更新范围 | 全部文档重写 / 当前文档全改、历史记录只修链接 | 当前文档（README、ADR、Phase 2 PRD）全部改为新路径；历史 update 与 Phase 1 PRD 保留原文，仅修正可点击链接 | 历史记录不重写叙述，但链接仍需可达 |
| 指标脚本 | 只统计新布局 / 兼容迁移前后 | `phase2-metrics.mjs` 把 `cli/` 前缀归一为 CLI 根内路径，并支持旧布局提交 | 迁移前后的提交可以直接比较，历史报告仍可复现 |
| 扩展边界测试 | 暂不检查 / 更新路径 | `Boundary.test.ts` 指向 `../cli/src` 与 `../cli/plugins` | 包边界检查必须在迁移后继续有效 |

## 数据模型

无领域模型变更。变更仅涉及仓库目录、npm 包边界、脚本与文档中的路径。

## 架构 / 流程设计

最终布局：

```text
svg-editor/
├── cli/                         CLI 独立 npm 包
│   ├── src/                     内核、前端、入口与宿主装配
│   ├── plugins/                 core 与可选插件
│   ├── test/                    单元、宿主、插件测试
│   │   └── fixtures/transcript/ 回放输入、期望输出与 SVG 样例
│   ├── scripts/                 回放校验与源码指标
│   ├── package.json / package-lock.json / tsconfig.json / vitest.config.ts
│   └── plugins.config.json
├── vscode-extension/            VS Code 独立 npm 包
├── doc/                         课程交付文档、PRD、ADR、update
├── docs/                        指标报告
├── refs/                        课程任务书
└── README.md                    仓库级入口说明
```

依赖方向不变：`cli/src` 内部仍按 frontend / backend / plugins 分层；`cli/plugins` 只依赖 `cli/src/backend/index.ts`；`vscode-extension` 不引用 CLI 源码。

路径解析随包边界调整：

- `cli` 的 npm 脚本以 `cli/` 为工作目录，`plugins.config.json` 的相对路径从配置文件所在目录解析，因此配置中的 `./plugins/core` 不变。
- `cli/test/main.test.ts` 以 `cli/` 为根运行真实入口，回放配置改为 `test/fixtures/transcript/phase1.plugins.json`。
- `cli/scripts/verify-transcripts.mjs` 继续用 `git archive final` 取 Phase 1 基线，但归档命令在仓库根执行；输出仍写到 CLI 的 `coverage/`。
- `cli/scripts/phase2-metrics.mjs` 在 `git ls-tree` 时使用 `--full-tree`，并把路径中的 `cli/` 前缀归一，保证迁移前后提交使用同一组文件键。
- `vscode-extension/test/Boundary.test.ts` 从 `../cli/src`、`../cli/plugins` 读取 CLI 源码做反向依赖检查。

实施过程中的一次修正：批量改文档链接时误用了 Windows PowerShell 5.1 的 ANSI 文本读写，两个未跟踪 PRD 的个别字节被替换为 `?`。已从当时的 Codex 会话记录恢复两个文件，并用 UTF-8 工具重做链接修改；此后文档批量改写不再使用 PowerShell 文本管道。

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| CLI 类型检查 | `cd cli && npm run typecheck` | 通过 |
| CLI 单元、宿主与插件测试 | `cd cli && npm test` | 62 个文件、564 项通过 |
| CLI 覆盖率 | `cd cli && npm run coverage` | 语句 88.54%、分支 82.80%、函数 92.98%、行 89.36% |
| 配置/代码双装配回放 | `cd cli && npm run verify:transcripts` | phase1、box、commands 全部 OK |
| 指标脚本兼容迁移前后 | `cd cli && node scripts/phase2-metrics.mjs final HEAD` | 退出码 0，输出 125 行 |
| 两种 CLI 入口 | `npm run cli:code` 与 `node --import tsx src/main.ts --config plugins.config.json` | 均进入 REPL |
| VS Code 扩展测试 | `cd vscode-extension && npm test` | 5 个文件、16 项通过 |
| VS Code 扩展类型检查 | `cd vscode-extension && npm run typecheck` | 通过 |
| VS Code 扩展构建 | `cd vscode-extension && npm run build` | 通过 |
| 文档链接 | 遍历仓库 Markdown 相对链接并检查目标存在 | 0 个失效链接 |

## 遗留问题

- 在 Windows PowerShell 5.1 中，`npm.ps1` 会吞掉 `npm run cli -- --config <path>` 的 `--config`；使用 `npm.cmd`、cmd.exe，或 `npm run cli -- -- --config <path>` 可正常工作。这是 npm 包装脚本的平台行为，与 CLI 代码无关。
- `verify:transcripts` 的 Phase 1 基线依赖 `final` 标签中的根目录布局；如果以后重写该标签，需要同步检查归档路径。
