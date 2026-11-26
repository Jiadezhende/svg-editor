# REFACT：编辑命令统一由基类保证失败恢复

- 提案时间：2026-11-27
- 完成时间：
- 类型：REFACT
- 关联 prd：doc/prd/phase2/20261126_SHAPE_REFACTOR.md

## 动因

“失败后恢复原状”目前靠每条编辑命令自觉实现：

- 10 个编辑命令里 7 个各自 `new UndoRecord()`（Create、Delete、Group、Ungroup、Addto、Front、Back）；
- `SetCommand` 自写一份 try/catch；
- `MoveCommand` / `ScaleCommand` 完全没有；
- `Document.transform` 与 `Box`、测试复合模型又各自在文档层、部件层回滚。

约定已经漏了两处，新增命令同样会漏——这不是“以后注意”能解决的。决定：失败恢复由 `EditCommand` 的执行模板统一提供，命令只声明恢复范围与动作；模型与文档不再自行回滚。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 原子性的保证机制 | 各命令调用 `UndoRecord` / 基类模板方法 | 基类模板方法 | 不实现快照方法就编译不过，新增命令漏不掉 |
| 恢复范围 | 模型、文档、命令 | 命令 | 只有命令知道本次编辑可能改动哪些对象 |
| `undo` 的归属 | 各命令自写 / 基类统一 | 基类统一 | 与快照同源；redo 走同一 `execute` 路径 |
| `UndoRecord` | 保留 / 并入 `EditCommand` | 删除公共类，能力并入基类 | 避免两套并存的恢复机制 |
| 文档与复合模型内的回滚 | 保留 / 删除 | 删除 `Document.transform` 的子树快照、`Box` 与测试复合模型的 `changeParts` | 与命令层重复 |
| 参数守卫的位置 | 上移执行层 / 留在命令 | 留在命令构造期 | 各命令的参数语义不同（正系数、有限偏移、参数个数），无法统一 |

## 数据模型

- `EditCommand`：`execute()` 改为具体模板方法，子类不再实现；新增 `protected abstract snapshot(): { restore(): void }`（在修改前调用，声明恢复范围）与 `protected abstract apply(): { result: CommandResult; undo: string }`（执行修改并给出撤销回显）；`undo()` 改为基类的具体实现。
- 编辑命令（Create、Set、Move、Scale、Delete、Group、Ungroup、Addto、Front、Back）：删除各自的 `undoRecord`、try/catch 与 `execute` / `undo`，改为实现 `snapshot` 与 `apply`。
- `UndoRecord`：删除文件与公共导出；其“捕获、失败恢复、成功后记录”的职责并入基类。
- 快照类型保持结构类型 `{ restore(): void }`，`ShapeMemento` 与 `DocumentStructureMemento` 均可直接返回。
- `Document`：删除 `transform` 的子树快照，`move` / `scale` 直接遍历节点。
- `Box` 与 `test/support/CompositeShape.ts`：删除 `changeParts`。

## 架构 / 流程设计

```text
Invoker.execute(command)
  result = command.execute()          # 失败时已由模板恢复，历史不变

EditCommand.execute()                 # 模板方法
  before = this.snapshot()            # 解析目标、捕获恢复范围
  try
    { result, undo } = this.apply()   # 修改并给出撤销回显
  catch
    before.restore(); throw

EditCommand.undo()                    # 基类统一
  before.restore(); 返回保存的 undo 文本
```

变化点：

- 原子性从“每条命令自觉”变为“类型系统强制”：新增编辑命令必须实现 `snapshot` / `apply`。
- 命令成功后基类才保存快照与撤销文本；`Invoker` 仍只在成功时更新历史，职责不变。
- `redo` 再次调用 `execute()`，同样经过快照与恢复，无需额外处理。
- 直接调用 `shape.move` / `doc.move` 失败会留下半改状态；该语义在 prd 中写明。
- 需要动态撤销回显的命令（Move、Scale）在 `snapshot` 时保存前态，`apply` 返回对应文本，输出与现在一致。

影响面：

- src：`command/EditCommand.ts`、删除 `command/UndoRecord.ts`、`index.ts`、`Document.ts`
- plugins：`core/{Create,Set,Move,Scale,Delete,Group,Ungroup,Addto,Front,Back}Command.ts`、`box/Box.ts`
- test：`Invoker`、`UndoRedo`、`PublicApi`、`ShapeInvariant`、`CompositeShape` 及各命令测试；`test/support/PublicExtension.ts` 的 `NudgeMarkerCommand` 与 `test/support/CompositeShape.ts`
- doc：更新关联 prd 的失败恢复边界与 `UndoRecord` 契约；更新 AGENTS 中“处理器失败恢复”的表述

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 每条编辑命令执行失败后文档与执行前一致、历史不新增、无成功回显 | 单元测试（逐命令） | 待定 |
| 容器内后一个子孙变换失败：整棵子树恢复 | 单元测试 | 待定 |
| undo / redo 回显与现在一致 | 单元测试 | 待定 |
| 新增编辑命令未实现 `snapshot` 时无法通过类型检查 | 类型测试 | 待定 |
| 直接调用 `shape` / `doc` 变换失败留下半改状态（记录语义，不做恢复断言） | — | — |

## 遗留问题

- `snapshot` 的范围由命令自行决定，框架只能保证“实现了快照并由失败路径恢复”，不能检查范围是否覆盖全部改动。
- 不在命令路径上的调用（插件直接操作模型）需自行保证恢复，属于扩展方责任，公共契约文档需写明。
