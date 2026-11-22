# ADR：内置能力与外部插件统一装配

日期：2026-11-20。状态：已实现，等待验收。

## 决策

六种具体 Shape 放入 plugins/shapes，17 个具体命令形式放入 plugins/commands。每包以 package.json 声明 name、contributes；内置包不再维护 index.ts，由宿主扫描包根目录的默认导出自动注册。包只依赖内核公共入口，命令通过工厂访问类型，不直接导入图形包。

宿主从空注册表构建会话。基础包和附加包使用同一发现、扫描、暂存、声明校验和失败隔离流程。删除 defaults，不保留第二份默认注册表、旧路径转导出或隐藏兜底。代码装配显式提供所需包；指定目录只发现该目录。详见[自动扫描 ADR](20261120_PLUGIN_AUTOSCAN.md)。

Client 保留 help、undo、redo、exit、quit；undo/redo 操作 Invoker，不实现为命令。init/read/save/canvas 属于用例命令，调用内核服务；DocumentCommand 历史规则不变。

## 顺序与 Handler

目录按名称排序，commands 可先于 shapes：激活只声明能力，执行用例时才查找模型。跨包同类重名拒绝后者，同包命令互斥形式保持原规则。命令包内部保留 help 顺序。

任意包可同时注册 Shape、AttributeHandler、Command、TreeDecorator。Handler 通过现有 registerAttributeHandler 插入，SetCommand 使用 Workspace 的注册表选择首个匹配项，无命中回退模型。局部快照、私有部件整体撤销及失败后历史不变保持原契约，不建设通用事务。

## 影响与验证

发行文件必须包含 plugins 两个基础包。空目录只提供框架入口；包失败按现有策略报告并隔离，无内置特权。配置、依赖排序和正式业务插件不在本次范围。

测试辅助入口读取真实包清单并调用实际 activate，通过 assemblePlugins 创建独立会话；单元测试可直接实例化被测模型或命令。真实 Node/tsx 验证代码装配与默认目录发现一致。全量 56 个文件、534 个测试及类型检查通过。
