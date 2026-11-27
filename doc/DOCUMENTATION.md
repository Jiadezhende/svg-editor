# 文档撰写规则

本文件规定仓库的文档层级、README 职责、产品文档结构和验收材料写法。CLI 已按此规则整理，VS Code 扩展可以按同一结构对齐。

## 1. 一个入口一个 README

README 只放在仓库、课程交付和产品根目录，最多四个：

| 文件 | 职责 |
| --- | --- |
| `README.md` | 仓库总览、两个产品的快速开始、文档地图 |
| `doc/README.md` | 课程交付文档：背景、运行、决策、验收证据、过程记录、一致性自查 |
| `cli/README.md` | CLI 唯一入口：安装、运行、配置、验证、文档索引 |
| `vscode-extension/README.md` | VS Code 扩展唯一入口：功能、安装/运行、测试/构建、结构、文档索引 |

以下位置不再新增 README：

- 产品子目录（`src/`、`test/`、`plugins/`、`samples/` 等）；
- 测试样例目录（如 `test/fixtures/transcript/`）；
- 验收证据目录（如 `docs/evidence/`）；
- 单个主题文档（架构、验收、插件指南）。

子目录需要说明时，写入产品级 `docs/<topic>.md`，由产品 README 链接。

## 2. 产品文档结构

每个独立产品采用同一结构：

```text
<product>/
├── README.md              唯一入口
└── docs/
    ├── architecture.md    详细架构
    ├── acceptance.md      验收结果与证据索引
    ├── <topic>.md         其他主题，如插件指南
    └── evidence/          原始证据：输出快照、指标、截图
```

`README.md` 只保留入口信息：一句话定位、安装/运行/构建/测试、最小目录说明、文档索引。架构细节、检查点明细、指标表和验收日志都放 `docs/`。

`docs/architecture.md` 写边界、分层、关键对象、运行时流程、设计模式和扩展点；不写安装命令和验收结果。

`docs/acceptance.md` 写验收环境、结论、结果表、检查点映射、证据索引、复现命令和已知限制；不重复架构说明。

`docs/<topic>.md` 写单一主题，例如插件包格式、模型扩展方式。不把多个主题塞进一个长 README。

`docs/evidence/` 放原始材料，文件名带日期或提交标识，例如 `20261127.md`、`metrics.txt`、`help.txt`、`screenshots/`。证据目录不再放 README，由 `acceptance.md` 索引。

CLI 的现有结构可作为参照：[`cli/README.md`](../cli/README.md)、[`cli/docs/architecture.md`](../cli/docs/architecture.md)、[`cli/docs/acceptance.md`](../cli/docs/acceptance.md)、[`cli/docs/plugins.md`](../cli/docs/plugins.md)、`cli/docs/evidence/`。

## 3. README 写法

README 建议包含：

1. 标题和一句话定位。
2. 快速开始：安装、运行、构建、测试。
3. 最小目录或模块说明。
4. 文档索引：指向 `docs/architecture.md`、`docs/acceptance.md`、`docs/<topic>.md`。
5. 与另一个产品的关系（如“扩展是独立项目，不引用 CLI 源码”）。

README 不写：

- 详细类的职责表；
- PlantUML 分层图；
- 完整验收检查点表；
- 逐文件的指标数据；
- 与 PRD/ADR 重复的决策记录。

超过一屏的实现细节应移到 `docs/`，README 只留链接。

## 4. 课程交付文档

`doc/README.md` 是课程交付入口，保留项目背景、运行方式、决策记录链接、验收证据、过程记录、一致性自查和质量保证。

产品相关章节（CLI、VS Code）只写摘要和链接：

- 详细架构指向 `<product>/docs/architecture.md`；
- 验收结果指向 `<product>/docs/acceptance.md`；
- 需求与检查点指向 `doc/prd/phase2/` 下对应 PRD；
- 不复制扩展点表、依赖图、按名分派表等详细架构内容。

## 5. PRD、ADR 与 update

- 需求文档放在 `doc/prd/phaseN/`，命名 `YYYYMMDD_<TOPIC>.md`。
- 决策记录放在 `doc/adr/`。
- 提案与完成记录放在 `doc/update/`，命名 `YYYYMMDD_<FEAT|REFACT|FIX>_<TOPIC>.md`。
- 一份 update 只关联一份 PRD。
- 产品文档只链接这些记录，不复制正文。
- 历史文档保留原叙述；路径迁移时只修可点击链接，不重写历史结论。

## 6. 命名与格式

- 文件名使用英文小写 kebab-case：`architecture.md`、`acceptance.md`、`plugin-guide.md`。
- 正文使用中文；类名、命令、路径保留原文。
- 日期使用 `YYYYMMDD`，用于 PRD、update 和证据快照。
- 表格用于矩阵、检查点、指标和文件清单；代码块标注语言。
- 相对链接从当前文件所在目录计算；不使用本机绝对路径。
- 文件使用 UTF-8（无 BOM）。批量改写中文文档时不要用 Windows PowerShell 5.1 的文本管道；使用编辑器、Node 或显式 UTF-8 API。
- 修改链接后运行全仓库 Markdown 链接检查；移动文件后同时检查锚点。

## 7. 事实与证据

- 测试数量、覆盖率、指标和结论必须来自实际命令输出，并记录日期、提交和环境。
- 区分“当前结果”和“历史快照”：历史报告保留目标提交，当前结果放 `docs/evidence/`。
- `.out`、指标报告等生成文件不手工编辑；重新生成后审查差异。
- 验收文档先给结论和结果表，再给证据链接；原始日志放 `evidence/`。

## 8. 单一事实来源

- 一个主题只保留一份权威文档；其他地方链接，不复制。
- README 是地图，不是百科。
- 架构只在 `<product>/docs/architecture.md` 展开；验收只在 `<product>/docs/acceptance.md` 展开。
- 发现内容重复时，把详细内容移到 `docs/`，在原处留一行链接。

## 9. VS Code 扩展的目标结构

按 CLI 的结构对齐：

```text
vscode-extension/
├── README.md                  功能、安装/运行、测试/构建、结构、文档索引
└── docs/
    ├── architecture.md        activate/deactivate、两个 provider、SvgSourceParser、包边界、调用流程
    ├── acceptance.md          A.1/A.2/A.3 检查点、测试与构建结果、GUI 手工验收状态、证据索引
    └── evidence/              截图、vscode-metrics、捕获输出
```

现有材料建议这样归位：

| 现有位置 | 目标位置 | 处理 |
| --- | --- | --- |
| `vscode-extension/README.md` | 保持为入口 | 删除详细实现说明，改为链接 `docs/` |
| `doc/README.md` 的 VS Code 章节 | 保留摘要 | 只链接 `vscode-extension/docs/`，不重复架构和检查点 |
| `doc/prd/phase2/20261125_VSCODE_*.md` | 保持 | 需求与检查点原文留在 `doc/prd/phase2/` |
| `doc/update/20261127_FEAT_VSCODE_EXTENSION.md` | 保持 | 提案与完成记录留在 `doc/update/` |
| `docs/metrics/vscode.md` | `vscode-extension/docs/evidence/` | 指标报告随产品走，并更新引用 |
| `vscode-extension/scripts/vscode-metrics.mjs` | 保持 | 生成脚本留在产品脚本目录 |
| 截图与手工验收记录 | `vscode-extension/docs/evidence/screenshots/` | 由 `acceptance.md` 索引 |

迁移后检查：

- 仓库仍然只有四个 README；
- `vscode-extension/README.md` 不重复架构和检查点；
- `docs/architecture.md` 与 `docs/acceptance.md` 分工明确；
- `doc/README.md` 的 VS Code 章节只保留摘要和链接；
- 所有相对链接可达，PRD/ADR/update 的引用同步更新；
- 测试数量、构建结果和截图状态取自实际输出。
