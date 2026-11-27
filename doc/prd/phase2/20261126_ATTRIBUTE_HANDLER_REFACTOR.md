# AttributeHandler 与 Receiver 分派重构

- 记录于 2026-11-26，所属阶段为 Phase 2
- 状态为已确认：分派位置、命中规则、回显接口和 Box 路由已定，待进入开发

## 需求背景

当前 `Receiver` 持有有序的属性处理器注册表，`SetCommand` 在匹配后选择写入方式并组织回显。创建和编辑都需要支持属性处理器，因此将共同的匹配和写入逻辑集中到 `Receiver`，由私有写入与公开设置入口分别服务创建和编辑。 [Receiver](../../../cli/src/backend/receiver/Receiver.ts) [SetCommand](../../../cli/plugins/core/SetCommand.ts)

## 决策记录

| 议题 | 决定 | 状态 |
| --- | --- | --- |
| 分派位置 | 匹配与写入集中到 `Receiver`：私有 `write` 完成一次匹配并执行写入，供 `create` 和 `set` 共用；`Shape.set` 只做本模型的基础写入。 | 已明确 |
| 命中规则 | 按注册顺序取首个匹配项；不收集多命中，不采用冲突拒绝或组合执行。零命中调用 `Shape.set`。 | 已明确（否决冲突拒绝提案） |
| 复合属性 | Handler 决定输入名称对应的部件和属性，通过模型公开的部件入口直接调用部件 `set`。 | 已明确 |
| 写入与回显 | 创建只写入。编辑由 `Receiver.set` 在写入前读旧值、写入后校验并读新值，前后回显共用同一次匹配。 | 已明确 |
| 校验归属 | `Receiver` 的公开入口调用 `Shape.validate()`，命令不调用。创建在全部写入后校验一次，编辑在本次写入后校验。 | 已明确 |
| Box 外观 | `Box` 不合并基础外观。`fill`、`stroke`、`stroke-width` 与 `label`、几何统一由 `box-attributes` 路由到 `Frame` / `Caption`。 | 已明确 |
| 几何编辑范围 | `create box` 的几何参数经同一 Handler 写入 `Frame`；`set` 复用同一路径因此也可用，本轮只验收 create，不单列几何编辑场景。 | 已明确 |

在 `Shape.set` 内分派能让调用方只记一个方法，但模型需要获得当前会话的匹配能力，Handler 写入同一目标时也可能再次命中自己。采用 `Receiver` 后，会话配置由 `Receiver` 使用，普通模型、内部部件和 SVG 恢复仍可直接使用模型方法。 [Shape 重构 PRD](20261126_SHAPE_REFACTOR.md)

创建路径不能直接调用公开的 `Receiver.set`：它会在每次写入后校验尚未完成的模型。创建由 `Receiver.createShape` 编排，内部复用同一个私有写入，最后统一校验。

## 接口契约

- `AttributeHandler` 延续静态契约 `handlerName`、`matches(shape, key)`、`apply(shape, key, token)` 和 `display(shape, key)`。`matches` 和 `display` 只读。`apply` 可以组合模型和部件的公开操作。 [Handler 契约](../../../cli/src/backend/receiver/document/shape/AttributeHandler.ts)
- `Receiver` 的私有 `write(shape, key, token)` 是唯一写入动作：解析一次匹配，零命中调用 `Shape.set`，命中调用 `apply`。它不做整图校验、不读回显，供创建和编辑共用。 [现有注册表](../../../cli/src/backend/receiver/document/shape/AttributeHandlerRegistry.ts)
- `Receiver.createShape(type, id, inputs)` 让工厂按类型和 id 构造候选，逐项调用 `write`，最后调用 `validate()` 并返回完成的图形。任一步抛错都结束本次创建，候选不入树。
- `Receiver.set(shape, key, token)` 只解析一次匹配：读旧展示值 → 写入 → `validate()` → 读新展示值，返回 `{ previous, current }`。`null` 表示该值未设置。旧值读取失败时不写入；校验失败时不读取新值。任一步抛错都传播原错误，状态恢复由命令的模型快照负责。 [创建及设置命令 PRD](20261126_CREATE_SET_COMMAND_REFACTOR.md)

## 复合图形的属性操作

`Box` 提供部件访问入口和标题重排，不再提供 `Box.setFill`、`Box.setLabel`、`Box.displayFill`、`Box.displayLabel` 等逐属性转发方法。`box-attributes` 把 `fill`、`stroke`、`stroke-width` 与几何写到 `Frame.set(...)`，把 `label` 写到 `Caption.set('text', ...)`；回显从同一部件读取。

- 几何写入后调用标题重排，按框体位置和尺寸重算文字坐标。框体几何尚未齐全时（创建写入过程中）不重排，最后一次几何写入自然得到正确位置。
- `Box` 覆写属性表为空，自身不再声明基础外观。写出时 `<g>` 只带 `id` 与 `data-kind`，外观统一落在 `Frame` 上，避免出现 `fill` 走框体、`stroke` 走 `<g>` 的分叉。
- 创建阶段的匹配和写入会看到尚未赋值的属性。Handler 不得假设必填项已就绪，也不得依赖目标已在文档中。 [现有 Box Handler](../../../cli/plugins/box/index.ts)

## 命中规则

- 注册顺序即优先级，首个命中负责整个操作，零命中才使用模型属性规则。同名属性可由不同 Handler 分别支持不同类型，例如一个负责 `Rect.fill`，一个负责 `Box.fill`。注册名称重复仍在注册阶段报告。
- 已否决“多个命中即拒绝”。任务书允许任一规则，但冲突拒绝需要额外的跨插件声明，并会推翻现有的注册顺序语义、ADR 和验收记录；保持首个命中改动最小。 [Phase 2 §3.3](../../../refs/phase_2.md)
- `SetCommand` 的调用链由 `Receiver.resolveAttributeHandler` 调整为 `Receiver.set`，现有 ADR 与扩展点清单的这句描述需同步。

## 验收场景

| 场景 | 输入或前置状态 | 预期行为 |
| --- | --- | --- |
| 首个命中 | 两个 Handler 匹配同一目标和属性键 | 只有注册顺序靠前的执行，后续匹配项不被调用。编辑失败时模型和历史保持原状，创建时整条命令失败且候选图形不入树。 |
| 默认写入 | 普通矩形的属性无 Handler 命中 | 调用 `Shape.set`，未知属性沿用 `unknown attribute` 错误。 |
| 匹配或写入失败 | `matches` 抛错，或选中的 Handler 修改后抛错 | 传播原错误，结束分派。已入树模型由命令恢复快照。 |
| 同一次匹配的回显 | Handler 写入改变了其 `matches` 依赖的状态 | 更新前后的回显都来自本次操作选中的 Handler。 |
| 回显未设置 | 匹配项的 `display` 返回 `null` | 按未设置处理，保留该 Handler 的结果。 |
| 部件路由 | 对 `Box` 设置 `fill` 或 `label` | Handler 直接写入对应部件，回显读取同一部件。 |
| Box 外观 | 对 `Box` 设置 `stroke` 或 `stroke-width` | 写入内部 `Frame`，`<g>` 上不出现外观属性。 |
| 创建几何 | `create box n1 120 100 160 60 "开始"` | 几何写入 `Frame`，标题写入 `Caption`，文字坐标按框体计算。 |

## 待确认

- 部件访问入口的具体形式：直接返回部件对象，还是返回只提供 `set`、`display`、`value` 的收窄接口。
