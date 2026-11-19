# 第二批：三类命令与局部撤销

完成日期：2026-11-19。基于 ShapeNode 架构。本批按课程项目需求收敛到 undo/redo，撤下此前新增的通用会话事务设施。

## 当前架构

- 查询命令直接继承 Command，编辑命令直接继承 EditCommand，文档命令继承 DocumentCommand；不恢复 StructureCommand 或 RelocateCommand。
- execute() 和 undo() 继续返回 CommandResult，不新增 EditExecution、HistoryEntry 或独立历史管理器。
- Invoker 的 undoStack/redoStack 保存 EditCommand。undo 调用命令的 undo()，redo 再次调用原命令的 execute()，成功后才移动历史项。
- 新编辑成功清空 redo；失败不入栈、不清空 redo，也不解除文档命令后的历史限制。查询不影响历史，文档命令成功后清空并限制历史。

## 局部快照与撤销记录

结构命令组合 UndoRecord，向其提供本次文档的结构快照和编辑动作。动作失败时恢复这份局部快照；动作和回显计算全部成功后才保存撤销快照和文本。失败的再次执行不会覆盖上一次有效记录。

UndoRecord 不引用 Workspace，不开启事务，不保存执行后的快照，不承担 redo 或历史栈管理。它仅复用局部失败恢复、快照记录与撤销回显。

set/move/scale 保留各自的属性撤销记录，在领域操作及结果计算成功后直接赋值。move/scale 使用 Document 的子树属性快照；业务复合模型通过自身 capture() 管理内部部件。结构快照仍只恢复节点身份、父子关系及顺序，不覆盖后来独立修改的属性。

分组、解组、创建、删除和迁移流程仍由具体 Command 编排，经 Document 公开入口修改树。Document 继续维护全局约束，不接管命令或历史。

## 删除的机制与能力边界

- 删除 Workspace.transaction、onCommit、protectState、完整会话快照及其队列。
- 删除 Document.captureState 和结构快照的附加引用属性捕获；保留模型属性快照、结构快照及跨文档恢复冲突预校验。
- Invoker 不再依赖 Workspace，Client 无需向其注入会话。
- 保留模型校验、文档子树变换的失败恢复、多步骤结构编辑的局部恢复。
- 不保证任意扩展命令在操作后继续修改会话、画布、文件路径或外部对象并抛错时，自动恢复所有副作用。
- 未来 Handler 在 set 调用边界捕获所需模型状态，处理其部分修改失败；不为此提前恢复通用事务系统。

## 验证

- npm run typecheck：通过。
- npm test -- --reporter=dot：42 个测试文件、432 个测试通过。
- 保留通用事务引入前的 428 个测试；移除仅验证整会话事务承诺的 11 个测试，新增 4 个撤销记录和真实编辑历史测试。
- 新增多轮属性/变换/分组 undo/redo、局部失败恢复并保留旧撤销记录、失败新编辑不清空 redo、redo 的 id 冲突可重试，以及跨文档恢复冲突后历史保留并可重试。
- 保留分组、解组、排序、节点身份、结构撤销不覆盖属性、CLI 输出及文档命令历史规则回归。

第三批公开契约与依赖注入尚未开始。本批完成后停在验收点，不自动提交或发布。
