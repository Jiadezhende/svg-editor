# CLI 代码与配置装配

- 记录于 2026-11-25，所属阶段为 Phase 2，任务书 §6

## 需求背景

扩展作者通过顶层代码装配或配置文件启用同一插件。两个入口需要得到同样的命令行为，并以相同规则校验清单、处理重名和隔离失败。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 注册入口 | 分别实现 / 共用宿主 | 共用现有 `registerPlugin` | 四类贡献信息已能由该入口统一校验。 |
| 配置入口 | 隐式读取 / 显式传入 | 正式 CLI 要求显式 `--config <path>` | 调用者可以选择基础版、完整版或其他组合。 |
| 失败隔离 | 逐贡献提交 / 逐包提交 | 构建并校验候选会话后整包接纳 | 清单不符、重名或构造失败时，先前可用插件可继续使用。 |

## 职责边界

- 代码入口显式导入插件。配置加载器解析路径、导入模块及读取清单，再交给同一个宿主。
- 模块由配置文件所在的目录或该位置的模块解析语义定位。图形、命令等业务行为由各贡献实现。 [扩展契约](20261125_CLI_EXTENSION_CONTRACTS.md)

## Cases 处理策略

| 场景 | 输入或前置状态 | 预期行为或错误 |
| --- | --- | --- |
| 完整配置 | 多个有效插件，部分有 `options` | 按配置顺序接纳，选项透传给激活函数。 |
| 禁用或空配置 | `enabled: false` 或 `plugins: []` | 禁用项跳过解析与求值。空配置保留五个框架命令。 |
| 缺少 CLI 参数 | 未传 `--config` 或未给路径 | 显示启动用法。 |
| 配置无效 | 文件不可读、JSON 或字段结构非法 | 输出 `error: invalid plugin config` 并装配基础包。 |
| 顶层模块缺失 | 配置指定的插件模块找不到 | `error: plugin not found: <module>`。 |
| 导入失败 | 模块存在但依赖缺失或模块求值抛错 | `error: plugin failed to load: …`。 |
| 缺少入口 | 模块无默认导出 | `error: plugin has no default export: <module>`。 |
| 激活失败 | 激活函数抛错 | `error: plugin failed to activate: …`。 |
| 声明或注册冲突 | 贡献与清单不符，或注册名称重名 | 分别报告 `plugin manifest mismatch` 或 `duplicate registration`，整包丢弃，继续处理后续包。 |

## 接口契约

代码入口为 `npm run cli:code`，配置入口为 `npm run cli -- --config <path>`。配置采用如下结构，省略 `options` 时激活函数收到空对象。

```json
{
  "plugins": [
    { "module": "./plugins/core" },
    { "module": "./plugins/stats", "enabled": false, "options": {} }
  ]
}
```

- `module` 为非空模块名或路径。路径可以指向带 `main` 的包目录或包内入口文件。
- 插件的 `package.json` 声明 `name` 和 `contributes`。贡献类别为 `shapes`、`commands`、`attributes`、`decorators`，缺省类别按空列表处理。
- 插件入口默认导出同步的 `activate(options)`，返回四类贡献。代码也可以直接向 `registerPlugin` 提交贡献对象。候选校验成功后才注册整包。

## 验证入口

运行 `npm test -- test/host/PluginConfig.test.ts` 和 `npm run verify:transcripts`。先核对同一目录和插件组合的回放，再检查两个接入提交的 Git 差异。 [装配 ADR](../../adr/phase2-04-plugin-assembly.md) · [差异复核](../../README.md#box-接入差异复核) · [总纲验收](20261125_PHASE2_DELIVERY.md#cli-代码与配置装配)
