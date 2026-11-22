# ADR：插件贡献自动扫描与清单契约

日期：2026-11-20。状态：已实现。

## 决策

插件包以 `package.json` 的 `name` 和 `contributes` 声明名称和贡献。宿主统一扫描包根目录的 `.ts`、`.mts`、`.js`、`.mjs` 文件，按文件名升序识别默认导出，并生成 `ExtensionPlugin.activate` 供宿主装配。`main` 字段不参与发现。

宿主将 `contributes` 声明的 shapes、commands、attributes、decorators 名称与实际暂存的集合比较。名称不一致时拒绝整包。

## 扫描规则与边界

- 每个参与扫描的文件默认导出一个贡献类。扫描跳过 `index.*`、`*.d.ts`、`*.test.*` 和隐藏文件。辅助代码放在子目录。
- Shape 按继承 `Shape` 识别，Command 按继承 `Command`，Decorator 按继承 `TreeDecorator`；Handler 不继承领域类，按静态 `handlerName`、`matches`、`apply`、`display` 识别。
- Shape 模块可同时 named export `mapping: SvgShapeMapping`，扫描器与默认导出的 Shape 一起注册。普通 Shape 继续使用 `SvgWriter` 的统一元素映射，不需要每类写代码；只有内部部件不是文档节点的复合 Shape 需要显式映射。
- 扫描逻辑位于宿主 `src/host/scan.ts`，领域内核不依赖文件系统。扫描结果只经 `ExtensionContext` 暂存，仍由 `assembleSources` 做清单校验、候选注册表构建、重名拒绝和整包失败隔离。
- 排序使用文件名升序；同一包内 Shape、命令、Handler、Decorator 的注册顺序由该顺序决定。命令 help 顺序与现有命令文件名顺序一致。

## 影响

- 随应用分发的基础图形和命令在 `plugins/core` 共用一份清单。业务扩展使用独立的 `plugins/extensions` 清单。
- 此前仅依赖 `main` 入口注册的插件需要把贡献类放到包根目录，并逐文件默认导出。显式代码装配仍可通过 `assemblePlugins` 传入带 `activate` 的对象。
- 新增内置图形、命令、Handler 或装饰器时只需新增类文件并更新 `contributes`；不再维护包入口注册表。
- 清单不一致、非法默认导出、加载失败、重名和激活异常仍按原错误前缀报告，并保留已接纳会话。

## 验证

真实 Node/tsx 下比较代码装配与目录发现输出。临时磁盘包覆盖四类贡献、文件名排序、扫描映射、忽略 `main`、清单不一致、非法默认导出和失败隔离。全量测试与类型检查通过，详见[自动扫描重构记录](../update/20261120_REFACT_PLUGIN_AUTOSCAN.md)。
