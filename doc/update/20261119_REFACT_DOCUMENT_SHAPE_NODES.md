# REFACT：文档节点树与 Shape 职责分离

> 本文保留该批次完成时的记录。后续第二批已删除 StructureCommand，改用组合式 UndoRecord 和局部快照恢复；当前实现见 [第二批记录](20261119_REFACT_UNDO_REDO_SIMPLIFICATION.md)。

- 提案时间：2026-11-19
- 完成时间：2026-11-19
- 类型：REFACT
- 关联 prd：doc/prd/phase1/20261016_HIERARCHY_ZORDER.md

## 动因

原实现把文档父子关系、成员数组及通用结构修改放在 Shape，再用 StructureEdit 阻止已入文档的模型被直接修改。会话持有 Document 并不能消除这些重复入口。本次直接移除 Shape 的树编辑 API，由 Document 统一维护节点树。

## 决策记录

| 议题 | 决定 | 理由 |
| --- | --- | --- |
| 树与图形 | 引入 ShapeNode，以 Shape 为 value | 图形领域行为与文档层级独立变化 |
| 标识与顺序 | Shape 保存 id；节点不另设 id/index | SVG id 稳定，位置天然由兄弟列表表达 |
| 结构 API | 使用节点，insert 与 relocate 分开 | 明确新图形加入和已有节点移动 |
| 普通 SVG 嵌套 | 每层 g 均保留为节点 | 普通分组不是隐藏内部结构的业务复合模型 |
| 业务复合模型 | 具体模型按需持有 Shape 成员，不持有节点 | 经模型公开方法处理部件，不要求全局寻址内部成员 |
| 撤销与失败恢复 | Document 结构快照 | 已移除对象不再承担保存文档子树的职责 |

## 数据模型及公开接口

- ShapeNode：只读 value、parent()、children()；内部私有回调读取 Document 模块保存的关系，不能从外部取得写入能力。
- Document：保存根节点列表、id 索引；模块私有弱映射登记节点关系和每个文档 Shape 的归属，Shape 不依赖该机制。
- Shape：保存 id、属性和领域行为，不再具有文档 parent/children/find 或结构修改方法。Group 仅提供分组属性与接入能力，不保存成员数。
- DocumentStructureMemento：封装绑定原 Document 的恢复闭包，保存节点引用及父子关系、顺序，不复制 Shape 属性或画布。
- StructureCommand：封装一次结构用例的执行前快照、异常恢复和 undo；继承 EditCommand，继续由 Invoker 维护历史。

```ts
insert(shape: Shape, parent?: ShapeNode | null, index?: number): ShapeNode;
remove(node: ShapeNode): number;
relocate(node: ShapeNode, parent: ShapeNode | null, index?: number): void;
children(parent?: ShapeNode | null): readonly ShapeNode[];
parent(node: ShapeNode): ShapeNode | null;
indexOf(node: ShapeNode): number;
findNode(id: string): ShapeNode | null;
requireNode(id: string): ShapeNode;
requireShape(id: string): Shape;
```

原 add/checkAdd 被 insert/checkInsert 替代；旧 Shape 树 API 不保留兼容包装。

## 架构与流程

### 结构修改与撤销

结构命令经 requireNode 定位，调用 Document 的公开入口。Document 校验归属、全局 id、模型接入规则、循环与索引后提交；同父级迁移索引按摘除后的列表解释。

remove 从当前文档移除全部后代、清空节点关系并释放归属。原节点与关系由历史快照保留；恢复前检查全部 Shape 的跨文档归属，冲突时不修改任一文档。恢复保留原节点和模型引用，不通过 SVG 重建。

创建、删除、分组、解组、排序和换组均使用 StructureCommand。多步骤操作失败恢复执行前结构；成功才更新该命令的 undo 快照。Invoker 的 undo/redo 成功后才转移历史栈，失败可重试。

### 属性变换与展示

Shape.move/scale/capture 默认只处理自身。Document.move/scale/capture 遍历节点子树，调用模型公开方法；任一节点变换失败恢复全部目标属性。自定义复合模型自行扩展自身内部成员的领域行为和快照，不向 Document 暴露内部树。

TreeCommand 遍历节点，ShowCommand 根据文档关系生成父级与成员数量。普通 CLI 的语法、回显、根级不可解组及文档类命令清空历史等规则保持不变。

### SVG

SvgReader 根据注册类构造 Shape，通过 Document.insert 建立候选文档树；成功后替换当前文档。SvgWriter 根据节点树输出普通 SVG。

业务复合模型可通过 SvgShapeMapping 将内部成员映射为 SvgElement 描述；映射属于持久化层，Shape 不依赖 SvgElement。Workspace.svgWriter().register(mapping) 装配映射，SaveCommand 复用该 writer。多个映射同时命中，或映射试图覆盖已有文档子节点时，明确报错。

当前测试复合模型写成普通 g；读回按普通 SVG 恢复全部节点，不假定恢复业务类型。save 的元素数依然统计文档节点，不统计映射产生的内部 SVG 元素。

## 测试与验证

- npm run typecheck：通过。
- npm test -- --reporter=dot：41 个测试文件、428 个测试通过。
- 覆盖根级和容器插入、指定位置、节点身份、id 冲突、同级排序、换父级、非法索引、循环和跨文档约束。
- 覆盖完整子树删除与多次快照恢复、跨文档冲突恢复失败、只读数组隔离，结构快照不覆盖属性和画布。
- 覆盖多步骤结构命令已经部分修改后失败的回滚，以及 undo/redo 失败后保留历史并重试。
- 覆盖多层分组变换及溢出恢复、复合模型内部部件快照、分组内复合模型变换不重复。
- 覆盖普通 SVG 多层嵌套往返、独立复合模型映射、save 复用注册映射，以及映射冲突。
- 保留 CLI 子进程端到端测试与既有文件读写失败测试。

## 遗留问题

- 未实现任意业务复合类型的 SVG 识别与恢复协议；内部成员不会自动成为 Document 可寻址节点。
- 结构快照每次保存整份文档关系，空间为 O(节点数)，本批不引入增量历史。
- 结构快照只恢复文档关系，不是任意插件同时修改属性和结构的统一事务；后续 Handler 事务另行设计。
- 插件发现、白名单配置及 Handler/TreeDecorator 不在本次重构范围。
