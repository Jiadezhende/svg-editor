# CLI 扩展契约

- 记录于 2026-11-25，所属阶段为 Phase 2，任务书 §1、§3

## 需求背景

课程要求在保留 Phase 1 编辑行为的前提下，允许独立接入图形、命令、属性处理器和树装饰器。扩展作者需要可查询的公开契约，以及统一的错误与撤销语义。基础包继续提供 Phase 1 的六种图形和 17 种命令形式。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 图形注册 | 单独的 provider 对象 / 图形类注册 | 具体 Shape 类承担课程 `ShapeProvider` 契约 | 类型、创建参数、构造与读回能力由同一类声明。 |
| 属性处理优先级 | 首个命中 / 多个组合 / 冲突即拒绝 | 按注册顺序选首个，零命中使用模型规则 | 插件顺序可确定覆盖关系，普通属性沿用 Phase 1。 |
| 编辑失败 | 会话级事务 / 命令持有局部快照 | 在单条 set 命令内记录目标模型快照 | 复合图形可一次恢复多个部件，Invoker 在成功后更新历史。 |

## 职责边界

- 内核声明契约、分派命令、维护文档结构与历史。插件实现具体图形和用户操作。
- `Document` 返回已有 `ShapeNode`，模型负责内部部件和本地约束。属性处理器通过模型公开方法完成特定语义。
- 宿主的模块加载、包级校验与错误隔离见 [双装配 PRD](20261125_CLI_ASSEMBLY.md)。树行展示见 [树标签 PRD](20261125_CLI_TREE_LABELS.md)。

## Cases 处理策略

| 场景 | 输入或前置状态 | 预期行为 |
| --- | --- | --- |
| 基础装配 | 仅启用 core | 原图形与命令可用，基础会话与 `final` 一致。 |
| 处理器匹配 | 两个处理器匹配同一模型和属性 | 仅调用注册顺序靠前的处理器。其显示值为 `null` 时表示未设置。 |
| 默认属性 | 无处理器匹配 | 走模型属性规则。未知属性报告 `unknown attribute: <key>`。 |
| 编辑失败 | 处理器修改目标后抛错，或修改后的回显抛错 | 恢复目标快照并传播原错误，撤销和重做历史保持原值。 |
| 命令参数非法 | 命令可用，输入不符合任一形式 | 输出用法，领域操作和历史更新均未发生。 |

## 接口契约

| 扩展点 | 公开能力 | 运行位置 |
| --- | --- | --- |
| `Shape` | 类声明类型和参数，提供构造、`parse(id, attributes, readChildren)` 与 `toSvg()`；`parse` 返回消费的 `parts` 和文档成员 `children` | `ShapeFactory.create` / `ShapeFactory.parse` 与 `SvgWriter` |
| `Command` | 命令名、用法、参数匹配及执行接口 | `Client` 选取形式，`Invoker` 执行 |
| `AttributeHandler` | 静态 `handlerName`、`matches`、`apply`、`display` | `SetCommand` 经 `Receiver` 查询有序注册表 |
| `TreeDecorator` | 装饰器名、只读行渲染和成功通知 | `TreeRenderer` 按注册顺序构建装饰链 |

## 验证入口

运行 `npm test -- test/backend/command/impl/SetHandlerCommand.test.ts test/host/PluginHost.test.ts`。框架提交为 `f1e5274`。 [扩展点清单](../../../cli/docs/architecture.md#12-扩展点) · [属性处理 ADR](../../adr/phase2-01-attributes.md) · [总纲验收](20261125_PHASE2_DELIVERY.md#cli-扩展契约)
