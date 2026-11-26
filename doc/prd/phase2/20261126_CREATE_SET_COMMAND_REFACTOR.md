# CreateCommand 与 SetCommand 流程重构

- 记录于 2026-11-26，所属阶段为 Phase 2
- 状态为已确认：创建与设置的写入、校验、回显接口已定，待进入开发

## 需求背景

创建命令根据图形声明解释位置参数，使用统一的构造契约获得完成的模型，再把它加入文档。创建和设置共用 `Receiver` 的写入入口。新增图形时，模型和插件提供参数声明、构造和领域规则，通用命令可以直接复用。 [Shape 重构 PRD](20261126_SHAPE_REFACTOR.md) [Handler 重构 PRD](20261126_ATTRIBUTE_HANDLER_REFACTOR.md)

## 决策记录

| 议题 | 决定 | 状态 |
| --- | --- | --- |
| 命令语法 | 本轮沿用现有 `create` 和 `set` 语法、位置参数顺序和可选参数。动态生成语法留作后续议题。 | 已明确 |
| 创建参数 | 命令通过只读声明得到参数名称和顺序，向 `Receiver` 传递有序的 `[属性名, 原始 token]`。名称由声明校验，可对应实际属性或内部部件。 | 已明确 |
| 候选构造 | `ShapeFactory` 按类型和 id 构造候选对象。`Receiver` 编排逐项写入和整图校验。 | 已明确 |
| 共同写入入口 | `create` 与 `set` 共用 `Receiver` 的私有写入（一次匹配加写入）。`create` 经 `createShape` 逐项写入后校验一次；`set` 经公开 `set` 在写入后校验并取得同一次匹配的前后回显。 | 已明确 |
| 编辑回显 | `Receiver.set` 返回写入前后的展示值；写入或校验失败时不读取新值。 | 已明确 |
| 整图校验时机 | `Receiver` 的公开入口在本次操作全部写入后调用 `validate()`，命令不调用。 | 已明确 |
| 错误顺序 | 类型和参数个数在构造期报告；容器不存在在定位期报告；参数值在写入期报告。 | 已明确 |
| 撤销与重做 | 一次成功的创建或设置是一条编辑记录。创建使用结构快照，设置使用模型快照。重做由 `Invoker` 再次执行原命令。 | 已明确 |

## 命令语法和位置参数

通用语法为 `create <type> <id> [params…] [in <containerId>]`。`CreateCommand` 通过所选类型的只读创建声明获取有序的必填参数名和可选外观参数名，把每个位置的原始 token 配给同位置的名字。`in <containerId>` 决定文档插入位置。双引号中的文字作为一个参数。下表为课程规定的参数顺序及其实际写入目标。 [Phase 1 §4.1、§4.4](../../../refs/phase_1.md) [Phase 2 §4](../../../refs/phase_2.md)

| 类型 | `id` 后的必填参数写入顺序 | 可选属性 |
| --- | --- | --- |
| `rect` | `x`、`y`、`width`、`height`，任务书将后两项简写为 `w`、`h` | `fill` |
| `circle` | `cx`、`cy`、`r` | `fill` |
| `ellipse` | `cx`、`cy`、`rx`、`ry` | `fill` |
| `line` | `x1`、`y1`、`x2`、`y2` | `stroke` |
| `text` | `x`、`y`、`text` | |
| `g` | 无 | |
| `box` | `x`、`y`、`width`、`height` 对应 `Frame`，标题参数 `label` 对应 `Caption.text` | |

`set <id> <attr> <value>` 直接从第二个命令参数取得属性名。默认写入使用图形允许修改的属性名，Handler 可以为指定类型提供 `label` 等操作名称。 [Phase 1 属性白名单](../../../refs/phase_1.md#41-create-的类型参数表) [Handler 重构 PRD](20261126_ATTRIBUTE_HANDLER_REFACTOR.md)

创建声明确定每个位置对应的参数名，并支持现有的命令用法反馈。`Receiver` 在全部赋值完成后调用 `Shape.validate` 检查模型必填值和整体约束。例如，创建声明把标题位置映射到 `label`，而 `Box` 校验 `Caption` 的文本状态。

## CreateCommand 执行流程

1. **解释输入。** 读取已注册图形的只读创建声明，检查必填参数个数和可选外观参数，识别 `in <containerId>`，用同一声明生成用法。创建参数的名称在自己的声明内校验，可对应实际属性或内部部件。按声明顺序组织必填输入，再加入显式给出的可选输入。命令传递原始文本，属性解析发生在实际写入时。
2. **定位插入位置。** 取得当前 `Document`，使用 `in <containerId>` 指定的容器或文档根。`in` 指定的容器不存在时报告 `no such container`；是否为容器、全局 id 和私有部件 id 由 `Document.insert` 统一检查。
3. **请求完成的模型。** 命令调用 `Receiver.createShape(type, id, inputs)`。工厂按类型和 id 构造候选，构造内绑定标识并准备部件。`Receiver` 逐项调用与编辑相同的写入：命中 Handler 则 `apply`，否则 `Shape.set`。全部写入后调用 `validate()`，通过后返回完成的 `Shape`。
4. **提交并输出。** 命令通过结构快照和 `UndoRecord` 组织 `Document.insert` 与 `created` 回显。只有成功插入后才有一条编辑历史和成功通知。任一输入写入、整图校验或插入失败时，文档关系和历史保持原状。 [现有 CreateCommand](../../../plugins/core/CreateCommand.ts) [ShapeFactory](../../../src/backend/receiver/document/shape/ShapeFactory.ts) [UndoRecord](../../../src/backend/command/UndoRecord.ts)

`create rect r1 10 20 100 50 red in g1` 将 `rect`、`r1` 和 `g1` 分别用作类型、标识和容器，依次传入 `x='10'`、`y='20'`、`width='100'`、`height='50'` 和 `fill='red'`。例如 `width` 没有 Handler 命中时，由 `Shape.set` 通过 `LengthAttribute` 解析和校验。

`Box` 声明 `label` 及几何创建参数，构造时准备 `Frame` 和 `Caption`。几何与外观经 `box-attributes` 写入 `Frame`，`label` 写入 `Caption.text`，几何写入后重排标题；创建完成时 `Box.validate` 检查部件结构。SVG 恢复使用模型的构造能力和文件中的部件属性。 [Box 模型](../../../plugins/box/Box.ts) [SVG 读入](../../../src/backend/receiver/svg/SvgReader.ts)

## SetCommand 执行流程

1. **解释输入并定位。** 读取 `set <id> <attr> <value>`，从当前文档取得已有 `ShapeNode` 及其 `Shape`。
2. **捕获模型快照。** 快照覆盖目标和复合模型的内部部件。
3. **写入、校验并取得回显。** 命令调用 `Receiver.set(shape, key, token)`。`Receiver` 只解析一次匹配：读取旧展示值，执行写入（Handler 可能修改多个部件），写入完成后调用 `validate()`，再用同一匹配读取更新后的展示值。`null` 表示未设置。命令保存撤销所需的旧展示值。
4. **完成或恢复。** 成功时用更新后展示值生成 `updated`。写入、整图校验或回显抛错时命令恢复快照并传播原错误；校验失败不读取新值。撤销恢复快照，并用缓存的旧展示值回显，旧值未设置时显示 `unset`。`Invoker` 在成功后更新历史。 [现有 SetCommand](../../../plugins/core/SetCommand.ts) [Invoker](../../../src/backend/invoker/Invoker.ts)

## 验收场景

| 场景 | 输入或前置状态 | 预期行为 |
| --- | --- | --- |
| 通用创建 | 使用已注册的基础或插件图形创建 | 参数顺序、用法和容器位置由统一命令处理，模型生成完整图形。 |
| 创建失败 | Handler 写入后抛错、缺少必填值，或 ID 冲突 | 创建失败，没有候选图形入树，历史和成功通知保持原状。 |
| 共用设置入口 | 创建和编辑命中同一个 Handler | 两者经同一次匹配写入；创建只写入，编辑另取得前后回显。 |
| 编辑部分失败 | Handler 修改多个部件后抛错，或写入后的回显抛错 | 恢复目标及其部件，历史保持原状。 |
| 编辑整图校验失败 | Handler 完成所有写入，但最终状态违反整体约束 | `Receiver.set` 在校验处失败，命令恢复目标及其部件，跳过更新后回显，历史保持原状。 |
| 旧值回显失败 | Handler 在写入前的 `display` 抛错 | 本次写入未执行，原有撤销和重做记录有效。 |
| 错误顺序 | 参数值非法且容器不存在 | 先报告容器不存在，尚未解析或写入任何参数。 |
| 撤销和重做 | 一次创建或设置成功后撤销并重做 | 一次命令对应一个撤销单元，重做再次执行原命令。 |

## 待确认

- 无。剩余为方法命名和部件访问入口的具体形式，不影响本契约。
