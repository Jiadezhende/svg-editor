# REFACT：插件贡献自动扫描

- 提案时间：2026-11-20
- 完成时间：2026-11-20
- 类型：REFACT
- 关联 prd：[doc/prd/phase2/20261120_PLUGIN_AUTOSCAN.md](../prd/phase2/20261120_PLUGIN_AUTOSCAN.md)

## 动因

`plugins/shapes/index.ts` 和 `plugins/commands/index.ts` 把类文件再列一遍。新增类时既要新增文件，又要修改注册表；注册表与类文件的 `type`、`command`、`handlerName`、`decoratorName` 可能漂移。目标是把发现和注册移到宿主：类文件是实现的唯一来源，宿主扫描后仍通过既有 `ExtensionContext` 暂存、清单校验和原子装配。

工作区此前已有一版未提交改动，删除了 `package.json` 的 `name`/`contributes` 和宿主清单校验，但测试仍按旧契约断言。按本次决策恢复 `contributes` 契约，只删除 `index.ts` 注册表。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 扫描位置 | 领域内核 / 宿主 | 宿主 `src/host` | 内核不依赖文件系统；扫描结果仍只经公共 `ExtensionContext` 注册 |
| contributes | 删除 / 保留 | 所有包保留，只删 `index.ts` | Phase 2 要求清单声明和 mismatch 报错；清单作为发布契约，类文件作为实现真源 |
| 扫描范围 | 包根目录 / 递归 / 固定目录 | 包根目录 `.ts`/`.js`，文件名升序 | 一个文件一个贡献类，顺序稳定；辅助代码放子目录 |
| 发现方式 | 包根目录扫描 / 自定义入口 | 统一扫描包根目录 | 所有发现包使用同一注册规则 |
| SVG 映射 | 每类都写 / 仅复合类型 | `SvgWriter` 不变；普通 Shape 无映射，复合 Shape 可用同模块 named export `mapping` | 普通元素已有统一写出；只有私有部件不是文档节点的复合模型需要显式映射 |
| 扫描失败 | 跳过文件 / 丢弃整包 | 丢弃整包并继续 | 与现有单包原子装配和失败隔离一致 |

## 数据模型

无领域模型变更。新增宿主函数 `scanPlugin(directory)`，返回标准 `ExtensionPlugin`；`PluginSource`、`PluginRegistration`、`Staged` 和 `Contributions` 保持原结构。

## 架构 / 流程设计

```text
createDiscoveredHost
  ├─ 读 package.json → name、contributes
  └─ scanPlugin(包目录)
        ├─ 根目录 .ts/.mts/.js/.mjs，文件名升序
        ├─ 默认导出 → Shape / Command / TreeDecorator / 静态 Handler
        ├─ Shape 可选同模块 named export mapping
        └─ 生成 ExtensionPlugin.activate(context)
  → assembleSources：暂存 → 清单校验 → 候选工厂/命令表/装饰链 → 接纳或整包丢弃
```

- 扫描逻辑集中在 `src/host/scan.ts`；`src/host/discovery.ts` 负责读取清单并构造 `PluginSource`。
- 扫描结果不直接写注册表，仍调用 `registerShape`、`registerCommand`、`registerAttributeHandler`、`registerTreeDecorator`，因此上下文关闭、重名拒绝、清单校验和失败隔离全部复用。
- 文件按名称排序；命令的 help 顺序与现有文件名顺序一致。Shape 注册顺序由文件名决定，不影响工厂查询或写出。
- 普通 Shape 继续使用 `SvgWriter` 的统一映射；只有复合 Shape 可在同模块导出 `mapping`，扫描器把它和默认导出的 Shape 一起注册。
- 内置 `plugins/shapes`、`plugins/commands` 删除 `index.ts`，`package.json` 保留 `name`、`type`、`contributes`，不再写 `main`。

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 发行包与代码装配输出一致 | 真实 Node/tsx 子进程，`scanPlugin` 与 `createDiscoveredHost` 对比 help、tree、插件列表 | 通过 |
| 扫描四类贡献 | 临时磁盘包，Shape/Command/Handler/Decorator 各一个文件 | 通过 |
| 文件名排序 | 临时包中 `ACommand.mjs`、`ZCommand.mjs`，help 顺序 | 通过 |
| 扫描清单不一致 | 声明 `declared-dot`，实际注册 `actual-dot` | 通过，整包拒绝 |
| 非法默认导出 | 默认导出普通对象 | 通过，整包拒绝并继续后续包 |
| 复合映射配对 | Shape 模块 named export `mapping`，写出含 `data-kind` | 通过 |
| 扫描加载与失败隔离 | 清单含 `main` 仍扫描，缺少默认导出、依赖与模块加载异常 | 通过 |
| 重复名称 | 跨包重复 shapes/commands/attributes/decorators | 通过，保留先前会话 |
| 全量回归 | `npm test`、`npm run typecheck` | 537 个测试、56 个测试文件通过；类型检查通过 |

## 遗留问题

- 内置包不再提供入口 `activate`；扫描模式由宿主合成等价入口。若后续课程验收要求每个包都有物理 `activate` 导出，需要再确认是否补一个无副作用的入口文件。
- 复合 Shape 的统一写出协议没有引入；当前只用可选 `mapping` 处理私有部件。该选择保留 `SvgWriter` 的现有边界。
- 配置装配、白名单、禁用和 options 仍不在本次范围。
