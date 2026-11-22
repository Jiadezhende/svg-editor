# 第一批：Shape 组成与文档结构职责

> 本文保留本批完成时的实现记录。后续文档树与 Shape 分离重构已移除 Shape 的文档父子关系及 StructureEdit；当前实现以 ShapeNode 和 Document 结构快照为准。

本批依据 AGENTS.md 落实模型自身约束、统一子节点组成及文档级结构入口。已根据审查调整：移除 Container、asContainer 和 ChildList，将分组、解组流程及撤销记录归回 Command。Handler、依赖注入、Parser 和树装饰链尚未引入。

## Shape、Group 与子节点数组

- Shape 直接封装 Shape[] | null：不支持子节点时初始化为 null，支持时初始化为空数组。children() 返回有序子节点副本；对叶子返回空数组，保持遍历调用方统一。查找、整体平移、缩放和属性快照统一递归整棵子树。
- Shape 提供 protected insertChild/removeChild，供具体模型构造和维护内部部件；这些方法仍遵守已入文档的结构修改限制。
- 公开 insert/remove 先检查模型规则。acceptsChildren() 默认根据子节点存储是否为 null 判断，Group 构造时初始化为空数组，因此允许编辑成员。复合模型初始化子节点数组后，可覆盖接入规则以封装内部部件；默认移除规则遵守该接入规则。
- Group 仅保留普通分组的成员开放规则和展示差异，不再单独保存 children，不重复实现递归行为。
- ChildList 类及其专用测试已删除；Shape 的结构方法直接维护有序数组和 parent，Document 直接维护顶层 Shape 数组和顶层挂接关系，不再把归属规则交给列表工具。
- 构造、set 和变换复用属性规格：必填属性完整，数值有限且类型正确，尺寸和线宽非负，字符串类型正确。变换先校验新属性，任一后代失败则恢复整棵子树属性。

## 父节点与结构归属

Container、ShapeParent 和 ShapeRoot 已删除。Shape.parent() 统一为 Shape | null：内部图形指向所属 Shape，顶层图形及脱离树的根为 null。Document 仅保存顶层数组，不作为 Shape 的 parent，也不继承 Shape。

requireParent() 只用于必须存在父 Shape 的场景，顶层图形同样会抛错。children()、viewBox() 返回副本，构造时也复制传入 viewBox，防止通过数组引用绕过模型入口。

文档归属与 parent 分离，StructureEdit 内部通过弱映射登记顶层图形的所属文档；Document 新增或移除顶层图形时同步登记和释放，后代通过父 Shape 链定位顶层归属。这样 parent 为 null 不会被误判为尚未入文档。

StructureEdit 是内部同步结构修改作用域。脱离文档的子树可通过模型方法构建，已入文档后的结构修改必须经过 Document；底层挂接和摘除同样检查作用域。该机制不是事务，也不是插件公开扩展点。

## Document：结构入口与全局约束

- add/insert 检查完整候选子树 id，包括子树内部重复和与已有节点冲突；目标必须属于当前文档，候选根必须未挂接。
- remove 删除文档中的已有节点，遵守所属模型的部件保护规则并返回原位置。
- add/relocate 的目标参数为 Shape | null，null 表示文档顶层，不再传入 Document 充当父节点。relocate 检查源、目标归属、循环引用和目标索引；同父节点索引按摘除后的序列解释。
- checkAdd/checkRemove/checkRelocate 是只读预检查入口，供多步骤命令在修改前校验全部受影响对象，实际修改入口仍再次校验。
- requireChildTarget 返回允许接收外部成员的 Shape，保持原有 CLI 的 no such container / not a container 错误语义。顶层 show 和撤销回显仍显示 svg，这是展示映射，不是 parent 引用。
- Document 不导入 Group，不再提供 group/ungroup/undoGroup/undoUngroup，也不持有分组用例记录。

## Command：分组与解组用例编排

GroupCommand 解析参数、定位成员、拒绝重复及祖先后代同时入组、按文档顺序排序、构造 Group，并预检查成员移除规则。随后通过 Document.add 加入空组，通过 Document.relocate 迁移成员。命令记录成员原位置；undo 经 Document 恢复成员再移除空组。

UngroupCommand 检查目标接入能力及禁止解散根级容器的既有规则，预检查容器移除和全部成员迁移，再经 Document 提升成员、移除空组。undo 先预检查，再经 Document 插回原组、迁回成员。

Shape 不声明解组操作或解组校验方法。其他结构命令及其撤销也统一经过 Document；Command 不直接改模型字段、子节点数组或父子关系。

本批只做模型约束预检查及模型内部属性回滚。任意自定义操作部分修改后抛错、整条命令与历史的原子恢复仍由第二批事务机制处理。

## 遍历与 SVG

Document 的全局遍历和 id 检查、tree 和 SvgWriter 直接调用 shape.children()，不再通过 asContainer 转换。create 和 addto 根据模型是否开放成员接入定位目标。

SvgReader 只适配新的目标类型和接入能力，保留现有普通 SVG 解析、警告及输出行为。Parser 编排与 Shape 类级解析的职责重构留在第五批。测试复合图形保存为普通 g，读回按既有普通分组行为处理，不提前实现复合类型解析。

## 验证

- npm run typecheck：通过。
- npm test -- --reporter=dot：41 个测试文件、449 个测试通过。删除 ChildList 专用测试后，成员操作边界由 Shape/Group 测试覆盖；新增顶层 null parent 的跨文档归属、释放归属及顶层/嵌套迁移测试。
- 保留分组、解组、排序、undo/redo 和 CLI 端到端回归，新增解组全部成员的目标规则预检查测试。
- 新增直接继承 Shape 的测试复合模型，验证组成、对象身份、父节点、全局 id、tree、SVG 保存、整体变换、属性快照及必要部件保护。
- 验证叶子拒绝接收成员，以及非 Group 的 Shape 子类开放成员接入后可用于 create/addto。
- 保留完整子树冲突、跨文档操作、循环引用、索引、非有限值、变换溢出恢复及可变引用隔离测试。
