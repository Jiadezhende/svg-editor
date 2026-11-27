# CLI 验收资料

本目录是 CLI 的验收入口，汇总验收结论、检查点、证据文件和复现方式。VS Code 扩展有独立的验收材料，不在本目录，也不参与 CLI 指标。

## 验收环境

| 项目 | 值 |
| --- | --- |
| 验收日期 | 2026-11-27 |
| 代码提交 | `5107f84`（CLI 迁入 `cli/`） |
| Node.js | 22.23.2 |
| npm | 10.9.8 |
| 平台 | Windows |

## 结论

CLI 本地验收通过：类型检查通过，62 个测试文件、564 项测试通过，三组回放与 `final` 基线一致，覆盖率与源码指标可复现。

## 一键复现

```bash
cd cli
npm install
npm run typecheck
npm test
npm run verify:transcripts
npm run coverage
node scripts/phase2-metrics.mjs final HEAD
```

Windows PowerShell 5.1 的 `npm.ps1` 会吞掉 `--config`；启动 CLI 时请使用 `npm.cmd run cli -- --config plugins.config.json`，或在 cmd.exe 中运行。

## 验收结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 类型检查 | 通过 | `npm run typecheck`；`results/20261127.md` |
| 单元、宿主与插件测试 | 62 个文件 / 564 项通过 | `results/20261127.md` |
| 覆盖率 | 语句 88.54%、分支 82.80%、函数 92.98%、行 89.36% | `results/20261127.md` |
| 配置/代码双装配回放 | `phase1`、`box`、`commands` 全部 OK | `test/fixtures/transcript/` [说明](../test/fixtures/transcript/README.md) |
| Phase 1 兼容性 | `phase1` 输出与 `final` 逐字节一致 | `test/fixtures/transcript/phase1.*` |
| 源码指标 | 脚本退出 0，内核/装配/插件三类均有结果 | `results/metrics.txt` |
| 命令入口 | `help` 列出 24 个命令形式 | `results/help.txt` |
| 文档链接 | 仓库 Markdown 相对链接 0 失效 | 2026-11-27 检查 |

## CLI 检查点

Phase 2 总纲中的 CLI 检查点全部通过。详细条目见 [`doc/prd/phase2/20261125_PHASE2_DELIVERY.md`](../../doc/prd/phase2/20261125_PHASE2_DELIVERY.md) 的「验收清单」，对应证据如下：

| 工作包 | 检查点 | 主要证据 | 状态 |
| --- | --- | --- | --- |
| 扩展契约 | 四类扩展点、首个命中、失败恢复 | `test/backend/PublicApi.test.ts`、`test/backend/handler/AttributeHandlerRegistry.test.ts`、`test/backend/command/impl/SetHandlerCommand.test.ts` | 通过 |
| 代码与配置装配 | 路径/包名/选项/禁用、失败隔离、空配置 | `test/host/PluginConfig.test.ts`、`test/host/PluginHost.test.ts`、`test/host/UnifiedPlugins.test.ts` | 通过 |
| 图形统计 | 空文档、混合文档、私有部件、查询不进入历史 | `test/plugins/Stats.test.ts`、`commands.out` | 通过 |
| 当前目录查看 | 混合目录项、稳定排序、失败输出、文档无关 | `test/plugins/Dir.test.ts` | 通过 |
| Box 复合图形 | 构造/嵌套/变换、属性撤销、读写降级、损坏拒绝 | `test/plugins/Box.test.ts`、`test/plugins/BoxSession.test.ts`、`box.out` | 通过 |
| 结构树标签 | 保存基准、撤销回基准、`* (box)`、基础输出兼容 | `test/plugins/ModifiedStar.test.ts`、`test/plugins/BoxSession.test.ts`、`test/backend/receiver/tree/TreeRenderer.test.ts` | 通过 |

## 证据索引

| 路径 | 内容 |
| --- | --- |
| `test/` | 与 `src/` 对应的单元测试、宿主测试与插件测试 |
| `test/fixtures/transcript/` | 回放输入、期望输出、外部 SVG 样例；见 [说明](../test/fixtures/transcript/README.md) |
| `scripts/verify-transcripts.mjs` | 配置装配与代码装配的逐字节比较；基础组还比较 `final` |
| `scripts/phase2-metrics.mjs` | 按内核、装配、插件输出文件数、行数与圈复杂度 |
| `results/20261127.md` | 本次验收的命令与结果快照 |
| `results/help.txt` | 完整配置下的 `help` 输出 |
| `results/metrics.txt` | `final` → `5107f84` 的源码指标报告 |
| `../../doc/README.md#phase-2-cli` | 架构说明、扩展点清单与验收证据 |
| [`../../doc/prd/phase2/20261125_PHASE2_DELIVERY.md`](../../doc/prd/phase2/20261125_PHASE2_DELIVERY.md) | Phase 2 总纲与 CLI 验收清单 |
| [`20261125_CLI_*.md`](../../doc/prd/phase2/20261125_CLI_EXTENSION_CONTRACTS.md) | 六个 CLI 工作包的需求、决策与验证入口 |
| `../../doc/adr/phase2-01-attributes.md` 等 | 属性处理、Box 读回、树标签与装配决策 |
| `../plugins/README.md` | 插件包结构与贡献声明 |

## 指标摘要

基线为 Phase 1 的 `final`，目标为提交 `5107f84`：

| 分类 | 文件数 | 行数 | 圈复杂度 |
| --- | ---: | ---: | ---: |
| 内核 | 58 → 43 | 2370 → 2056 | 483 → 531 |
| 装配 | 1 → 5 | 18 → 339 | 3 → 131 |
| 插件 | 0 → 30 | 0 → 1155 | 0 → 237 |

迁移前位于仓库根目录的 `src/`、`plugins/` 与迁移后的 `cli/src/`、`cli/plugins/` 按 CLI 根目录内的路径归并，因此可以直接比较。

## 已知限制

- 指标脚本以 Git 提交为输入，不统计工作区未提交文件；验收新变更时先用目标提交替换 `HEAD`。
- `verify:transcripts` 的 Phase 1 基线依赖 `final` 标签中的根目录布局。
- `docs/metrics/` 中的两份 CLI 报告是历史目标提交的快照；当前结果以 `results/metrics.txt` 为准。
- VS Code 扩展不依赖 CLI，也不计入上述指标；其验收材料由扩展包单独维护。
