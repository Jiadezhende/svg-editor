# SVG Editor CLI

命令行 SVG 编辑器，包含内核、插件实现、配置与测试。VS Code 扩展是独立项目，见 [`../vscode-extension/`](../vscode-extension/README.md)。详细架构见 [docs/architecture.md](docs/architecture.md)。

## 运行

要求 Node.js 22.14 或更新版本。

```bash
npm install
npm run cli -- --config plugins.config.json
npm run cli:code
```

`npm run cli` 必须传入 `--config <path>`；`npm run cli:code` 使用代码装配。两者装配同一套插件，并用同一份清单校验。

## 目录

```text
src/main.ts                 配置入口：读取插件配置、装配命令表并启动 CLI
src/cli-code.ts             代码入口：静态导入插件后装配
src/bootstrap.ts            宿主：插件清单校验、贡献注册与会话构建
src/pluginConfig.ts         配置解析与模块加载
src/backend/                内核：Shape、Document、Handler、Command、SVG 读写、树渲染
src/frontend/               读行、分词、结果输出与控制台适配
plugins/core/               Phase 1 基础图形与 17 个命令形式
plugins/{stats,dir,modified-star,box}/  可选插件
test/                       与 src/ 对应的单元测试、宿主测试与插件测试
  test/fixtures/transcript/   CLI 回放输入、期望输出与 SVG 样例
scripts/                    transcript 双装配校验与源码指标
docs/                       CLI 架构、验收、插件文档与验收证据
```

## 配置

```json
{
  "plugins": [
    { "module": "./plugins/core" },
    { "module": "./plugins/stats", "enabled": false },
    { "module": "./plugins/dir" },
    { "module": "./plugins/modified-star" },
    { "module": "./plugins/box", "options": {} }
  ]
}
```

相对路径从配置文件所在目录解析；`enabled: false` 跳过模块解析和求值；`options` 传给插件默认导出的 `activate(options)`。配置整体无效时报告错误并装配基础包，单包失败后继续装配后续包。插件编写见 [docs/plugins.md](docs/plugins.md)。

## 验证

```bash
npm test
npm run typecheck
npm run coverage
npm run verify:transcripts
npm run metrics -- final HEAD
```

`verify:transcripts` 比较配置装配与代码装配的输出，并把 Phase 1 基础会话与 `final` 标签中的程序逐字节比较。

验收检查点、当前结果与证据文件见 [docs/acceptance.md](docs/acceptance.md)。

## 文档

- [docs/architecture.md](docs/architecture.md) — 分层、领域模型、命令、持久化、装配与依赖规则
- [docs/acceptance.md](docs/acceptance.md) — 验收结果、检查点、证据与回放样例
- [docs/plugins.md](docs/plugins.md) — 插件包结构、清单与贡献声明

## 扩展入口

插件只依赖 `src/backend/index.ts` 的公开契约。设计与分层说明见 [doc/README.md](../doc/README.md)。
