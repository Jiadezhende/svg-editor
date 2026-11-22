# 内置能力统一插件迁移

日期：2026-11-20。三个步骤均已完成，停在验收点。

## 实现与提交

1. `789f6f4`：六种 Shape、17 个具体命令形式移入 shapes、commands 两个插件包，使用公共入口导入。增加清单和 activate，类型检查覆盖插件源码。为避免自动发现与 defaults 重复注册，提前让生产宿主从空注册表构建；此步 522 项测试通过。后续的[插件贡献自动扫描](20261120_REFACT_PLUGIN_AUTOSCAN.md)删除了两包手写 index.ts，改由宿主扫描包根目录默认导出；清单和校验路径保持不变。
2. `1a23bea`：删除 defaults，测试改用真实包声明及异步插件装配，逐次创建独立会话；522 项测试通过。
3. 本记录所在提交：新增统一路径验收及架构文档，56 个测试文件、534 个测试通过，类型检查和差异检查通过。

## 功能边界

五个框架入口 help、undo、redo、exit、quit 留在 Client。Invoker 历史仍存 EditCommand，成功后才转移历史；未增加 UndoCommand/RedoCommand。具体文档命令作为插件调用内核服务。

Handler 接入位置保留在 ExtensionContext.registerAttributeHandler、Workspace.attributeHandlerRegistry 和 SetCommand；包可同时贡献模型和处理器，别名归 matches，首次命中、不命中回退与失败快照恢复不变。

## 验收

- 原 CLI 脚本、分组、排序、读写、树、help、撤销重做回归保持兼容。
- 空装配仅保留框架入口；禁止插件占用五个保留名称；基础包无特殊注册路径。
- 真实 Node/tsx 下，发行包的代码装配与目录发现具有相同插件列表、help 和执行输出。
- 测试插件同时贡献复合模型和 Handler，覆盖别名、多部件整体撤销、多轮 redo、无匹配回退、修改和展示失败恢复、失败 redo 重试。
- 内核和宿主不导入具体插件；插件只导入公共内核入口及包内实现。

未实现配置、正式业务插件或依赖管理；未推送、打标签或发布。无关参考文件未纳入提交。
