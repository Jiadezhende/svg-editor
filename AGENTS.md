# 架构与扩展设计约定

## 阅读与分层顺序

先理解 Shape：它是领域模型，封装一个图形的状态、结构和行为。ShapeNode 以 Shape 为 value 组成内存文档树，由 Document 管理节点关系、画布、查找及全局约束。

在这些对象之上，Handler 表达可注册的领域方法，Command 像应用 service 一样编排一次用户用例，并组织事务和撤销。SvgReader / SvgWriter 负责内存文档与 SVG 文本之间的持久化映射。

本文先按「Shape → Document → Handler → Command → SVG 读写 → 树展示」说明架构，再汇总调用关系，最后说明注册、配置与依赖装配原则。说明概念时先定义基础对象，再说明依赖它的结构与行为；运行时调用顺序另行展示，不与概念介绍顺序混淆。

本文描述 CLI 的架构，路径相对 `cli/`（例如 `src/backend/index.ts` 即 `cli/src/backend/index.ts`）。`vscode-extension/` 是独立产品，不引用 CLI 的 `src/` 或 `plugins/`。

## Shape：领域模型

- 持有单个图形的状态，封装内部部件，通过公开方法修改自身；业务复合 Shape 按实际需要声明内部 Shape 成员；普通 SVG 容器的成员关系保存在文档节点树中。
- 保证自身不变量，例如 Box 必须具有有效的矩形和文字；由 `validate()` 检查必填属性、跨属性约束与部件结构；不承担整份文档的全局 id 检查。
- Shape 维护 SVG id，不维护 index、文档归属、文档父节点或通用 children 字段，不提供文档树 insert/remove/relocate。业务复合模型的内部成员默认不成为独立文档节点。
- Shape 区分模型身份与文件身份：`modelLabel()` 是命令回显的 `<type>#<id>`；`fileLabel()` 是 tree/show 使用的 `<element>#<id>`。`element()` 返回图形写出的底层 SVG 标签，默认与 `type` 相同，复合模型可覆写（如 Box 的 `g`）。
- Shape.identifiers() 声明自身及私有部件占用的全部 id；默认由 `parts()` 递归汇总，特殊模型可覆写，必须包含根 id、不得重复或非法。声明只读且随模型身份保持稳定，不暴露内部对象或文档关系。
- Shape.toSvg() 返回自身及私有部件的元素描述 `SvgElement`；默认实现通过多态 `parts()` 递归组合，复合模型通常只需覆写受保护的 `parts()`，需要额外包装或根属性时再覆写 `toSvg()`。`element() !== type()` 时基类自动写 `data-kind`。
- `SvgElement` 是位于 `document/shape/` 的纯数据契约，不含 XML 文本、节点关系或解析能力；SvgWriter 负责转成文本。
- Handler、Command 和 Document 都不能绕过图形公开方法直接修改其内部状态。Shape 不依赖 Handler 注册表、Command、CLI 或 SVG 解析器。
- 属性对象或模型负责共享的值解析、校验与基础修改规则，避免创建、属性设置和读回各写一套。
- `Shape.move` / `Shape.scale` 是抽象方法，由各模型按自身属性实现；`Attribute` 只负责值的解析、校验、展示与默认值。
- 图形属性的值与规则位于 `shape/attribute/`。命令、属性对象、SVG 读写和树渲染共用 `backend/utils/DecimalFormat.ts` 的十进制文本规则。
- 静态 Shape.parse(id, attributes, readChildren) 提供可覆写的数据构造能力，默认通过属性对象解析文本及默认值。结果 ShapeParseResult 包含构造出的 shape、消费的私有部件 parts 和仍应作为文档成员的 children；Shape 本身不保存这份文档关系。
- 复合图形在构造时建立内部部件，完整性由 `validate()` 检查。内部部件通过模型公开入口访问，属性修改由 Handler 组合模型的公开操作完成；跨部件约束（例如标题位置）仍由模型保证。

## Document：上层内存文档结构

- Document 是由 ShapeNode 组成的内存 SVG 树，每个节点的 value 是已经构建的 Shape，负责保存、组织和查找这些对象，不承担 SVG 文本解析或按需实例化。
- 文本解析、类型查找与实例构建发生在读入或创建流程中：SvgReader / 创建命令通过图形注册契约构建实例，再将有效子树加入文档。
- `Document.findNode(id)` 和 `requireNode(id)` 统一返回已有 ShapeNode，通过 node.value 获取 Shape，运行时可以是 Box 等具体子类；查找不重新解析文本、不构建新对象。Document 不提供 requireShape/find/shapes 等模型快捷入口，不需要导入具体插件模型类。
- 负责画布信息、文档级树结构操作，以及全局 id 唯一性等跨图形约束；涉及树结构变更的调用必须经过维护文档级约束的公开入口。
- Document 通过 ShapeNode 组织 Shape 抽象，Shape 保持独立于具体 Document 和节点树实现。节点不另设 id 或 index，index 来自父节点列表；父子关系只读公开，由 Document 统一修改。
- insert(shape, parentNode = null, index?) 支持顶层与容器插入并返回节点；relocate/remove 以已有节点为对象。节点父子关系直接读取 node.parent()/children()；Document.children() 只返回顶层节点，indexOf(node) 计算位置。
- Document 编排文档子树变换与属性快照；结构命令使用绑定原文档的结构快照恢复节点身份、层级和顺序。
- Document 在 insert 和结构快照恢复前统一验证节点及私有部件的全部 id，失败不修改关系；节点索引仍仅包含 ShapeNode。Writer 的最终元素树校验继续作为独立的持久化保护。
- 不集中实现各具体图形的标题、填充等内部行为；定位目标后，由图形公开方法或相应 Handler 完成操作。
- 不依赖 Command、Handler 注册表、CLI 或 SVG 解析器。

## Handler：领域操作层

- AttributeHandler 是可注册的领域属性方法，通过模型公开接口完成领域操作。契约与注册表和 Shape 放在同一目录，具体 Handler 由业务插件提供。注册静态类本身，不创建实例；公开契约为 handlerName、matches、apply、display。
- 负责判断是否适用，并表达操作语义，可组合调用一个或多个模型公开方法。例如 box 的 fill 表示修改框体填充，label 表示修改标题。
- Handler 可以包含领域规则与操作组合；属于模型自身、所有入口必须遵守的结构约束和基础校验，仍由模型保证。
- 不承担 CLI 分词、输出格式、文件 I/O、插件加载或独立的 undo/redo 历史管理。
- 只负责修改；失败由编辑命令按自身声明的快照统一恢复，不要求通用会话事务，处理器不自行回滚，失败后不能再转入默认处理。
- AttributeHandlerRegistry 按启用顺序调用 matches，首个命中即停止，顺序就是优先级；无命中才使用已有模型属性规则。不收集多命中，也不采用冲突拒绝或组合执行。
- 模型类型、属性 key 和别名判断集中在 matches；注册表只保存有序静态类，不维护具体属性映射。matches 和 display 必须只读，静态类不保存单次执行状态。
- Receiver 在编辑时定位目标并查询一次注册表，命中后通过 apply 修改、display 取得领域回显值；null 表示未设置，不触发回退。匹配错误直接传播，执行或展示错误由命令的快照恢复后传播，均不继续尝试后续 Handler。
- 创建与设置共用 Receiver 的内部写入；创建逐项写入后校验一次，编辑在写入后校验并读取前后回显。整图校验由 Receiver 的公开入口调用 Shape.validate()，命令不调用。
- 只有需要独立增加、替换或开放给插件的领域操作才抽成 Handler，不把所有模型方法机械地包装为 Handler。

## Command：应用服务层

- 负责命令参数和用例前置条件、定位目标、调用领域操作、组织结果回显。
- 通过公开契约访问当前文档、领域操作和持久化能力，不直接修改模型字段或内部子部件。
- 不实现图形专属业务规则，不在通用命令中不断增加 box 等具体类型分支。
- `EditCommand` 的模板方法统一组织快照、失败恢复与撤销回显：一次用户编辑命令构成一个 undo 单元，子类只声明恢复范围与操作；调用多个领域方法也整体撤销、整体重做，不提前引入通用会话事务框架。
- 普通操作可以直接调用模型公开方法；只有开放为扩展点的操作才需要查询 Handler，不强制每次操作都经过 Handler。
- 宿主取得插件提供的命令类，将静态定义和已绑定 Receiver 的创建函数组装为命令表，校验后注入 Client。Client 负责分发与 help，调用创建函数取得命令，并交给 Invoker。

- help、undo、redo、exit、quit 是 Client 的框架入口，不实现为 Command 或插件；undo/redo 直接调用 Invoker，历史栈仍保存 EditCommand。init、read、save 和 canvas 等用例命令通过公开服务接口由插件提供。

## SVG 读写：持久化映射层

- SvgReader 将 SVG 表示恢复为领域模型，SvgWriter 将模型映射为 SVG；文件访问负责实际读写，领域修改不通过序列化再解析来完成。
- 负责 XML 语法、元素与属性映射、持久化标记及读入降级策略，不承载 CLI 用例或属性编辑业务规则。
- 读回通过图形注册契约及模型公开的构造、恢复能力生成有效对象；恢复数据不通过编辑 Handler 模拟用户命令，避免触发编辑语义或历史。
- 读入先构建候选文档并完成校验，成功后再替换当前文档；创建子树同样先校验再提交，失败不留下半成品。
- 类型特有的恢复信息通过图形类注册契约提供，通用解析器负责统一流程，接口需明确子元素递归职责。
- SvgReader 通过 ShapeFactory.parse 调用注册类；模型按需调用 readChildren 获得子 Shape，递归和缓存仍由 Reader 完成。`ShapeParseResult` 显式返回消费的 `parts` 与仍作为文档成员的 `children`；二者必须是输入子 Shape 的非重复引用，未归属输入报错。不能静默消费仍带文档子节点的普通容器。
- Reader 校验解析结果：模型类型、`element()` 与输入标签一致；消费的 part id 必须属于 `identifiers()`；文档成员不得占用私有 id。
- data-kind 对应已注册类型时使用该类型，未安装则按原标签降级；已安装但结构无效时拒绝读入，不降级或调用编辑 Handler。全输入 id（含根、私有部件和跳过子树）统一检查。
- 当前持久化格式为 SVG，解析与映射围绕现有格式实现。普通 SVG 的多层 g 完整恢复为文档节点树，不自动封装为业务复合 Shape。
- 形状的写出由模型多态提供：`Shape.toSvg()` 生成自身及私有部件，`element() !== type()` 时自动带 `data-kind`。Writer 不持有类型映射表，也不按类型分支；它只把文档成员按原顺序追加到模型自身元素之后。
- Writer 在生成文本前校验元素名、`data-kind` 和声明 id 是否都已写出，再做整棵元素树的重复/非法 id、重复 id 属性及文本与子元素并存的检查；失败不写文件。

## 树展示与装饰链

- 基础树渲染负责节点基础内容、缩进与连线。TreeDecorator 负责在基础行之后追加标签，通过只读的公开信息决定是否追加。
- 使用经典 Decorator 结构：装饰器和基础行渲染器遵循同一渲染接口，装饰器持有被包装对象，先委托渲染，再追加自身标签；不适用时返回被包装对象的结果。
- 宿主按插件装配顺序及各包的贡献顺序依次包装基础行渲染器。列表从前到后的顺序对应最终标签从左到右的顺序。
- 例如列表为 modified-star、box-type，构造结果为 BoxType(ModifiedStar(Base))，最终行尾为 `* (box)`。外层先进入，内层先返回，标签按配置顺序追加。
- 装饰器列表为空时直接使用基础行渲染器，输出与原基线一致。
- 装饰器的状态封装在实例中；新增装饰器不修改内核、基础渲染器或其他装饰器。
- TreeCommand 委托 TreeRenderer，TreeDecorator 通过受保护 tag 追加标签，可通过 onSuccess 维护实例状态。渲染和通知使用冻结的图形视图与画布快照。复合模型可提供私有部件的视图，文档将其排在普通文档成员之前。视图只包含内容、展示信息和子视图。
- show 读取同一视图的 `details` 并递归私有组件；组件展开时不再输出 `children=`，文档成员仍由 tree 展示。视图的 `label` 使用文件身份，组件块不带 `parent=`。
- Client 在 Invoker 成功更新历史后发布 edit/undo/redo/replace/save；DocumentCommand.successKind 声明成功通知类型，画布调整保留文档类历史规则并通知 edit。失败不通知，观察者异常转为展示警告，不把已提交操作误报为失败。不建立通用事件总线或事务。

## 完整调用关系

```text
CLI 输入 → 分词 → Client 创建并分派命令 → Invoker → Command（应用服务）
                                                       └─ Receiver 提供编辑器操作
                                                            ├─ Document → 已有 Shape
                                                            ├─ Handler 查找 → 领域属性操作
                                                            └─ 文件访问与 SVG 文本

持久化路径：
SVG 文件 ⇄ 文件访问 ⇄ SvgReader / SvgWriter ⇄ Document（内部为 Shape 树）

内存组织关系：
Document（画布、节点树、全局约束）
  └─ ShapeNode（value、只读父子关系；无独立 id/index）
       ├─ value: Shape（状态、领域行为、自身约束）
       └─ children: ShapeNode[]（Document 维护）

业务复合 Shape 可直接持有内部 Shape 成员，不持有 ShapeNode。

装配路径：
宿主 → 注册 Shape 类、Handler、TreeDecorator → 构建 Receiver
宿主 → 将 Receiver 绑定到命令创建函数 → 构建并校验命令表 → 注入 Client
```

## 模型扩展与注册

- 新增模型通过具体 Shape 类及按需的 Handler 接入。
- 具体 Shape 类的静态描述与构造能力承担图形类型注册契约。创建参数默认复用属性模板，特殊模型可单独声明。ShapeFactory.register 接收 Shape 的类对象，在运行时校验继承关系、类型名和解析方法。使用侧通过 has/definition/create 获取支持信息、只读规格和候选实例，不能查询构造函数。
- 课程中的 ShapeProvider 对应图形类型注册契约，由具体 Shape 类承担；交付文档须明确对应关系。
- ShapeFactory 负责注册、查找与创建；具体图形的选择和注册放在宿主装配侧，工厂不自行导入、枚举插件图形。
- 普通图形无需专门 Handler。特殊领域操作通过 Handler 独立注册；模型不依赖其处理器，处理器可依赖模型公开接口，两者可以同包维护。
- Command 注册命令名、参数规则及执行能力；TreeDecorator 注册树行标签的生成能力。

## 扩展装配与配置

- 正式 CLI 要求显式指定配置路径。宿主按配置顺序解析插件模块，跳过禁用项，向入口默认导出的 `activate(options)` 传递选项。有效空配置只提供五个框架入口。配置整体无效时报告错误并装配基础包。
- 代码装配静态取得插件。两种入口调用同一个 `registerPlugin`，也可直接传入已分类的类。包通过 `package.json` 的 `name`、`contributes` 声明贡献。名称须匹配实际贡献，跨包同类重名拒绝，单包仍可注册同一命令的多个互斥形式。
- Shape 的读写能力由类自身提供（`parse` / `toSvg`），装配只注册模型类。宿主核对清单后构建候选注册表、writer、装饰链和 Client，全部通过才接纳。单包失败时报告并继续，保留此前接纳的插件。插件激活负责返回贡献，外部副作用不参与候选会话回滚。
- `plugins/core` 提供六种基础图形和 17 个命令形式。插件包可组合任意贡献类别，测试也可直接提供分类后的类，与 CLI 共用整包装配与清单校验。

## 依赖与装配边界

- 内核定义公开领域抽象和扩展契约，通过契约调用扩展，不导入具体插件。
- 宿主和扩展的公共导入入口为 `src/backend/index.ts`；ShapeNode 只导出类型，节点构造及关系存储不作为扩展接口。
- ShapeFactory 初始为空。main 按配置装配插件，独立的代码入口使用显式导入列表。宿主向 Receiver 注入工厂、文件访问、SvgReader、SvgWriter、AttributeHandlerRegistry 和 TreeRenderer。Receiver 持有当前文档及路径，并公开创建、设置、校验与查询操作。
- 宿主完成接收者与具体命令的绑定，承担经典命令模式的装配职责。Client 构造时接收只读命令表和成功通知回调；Invoker 调用 Command 的执行与撤销接口并管理历史。CLI 通过 CommandSession 执行命令并查询退出状态。
- 插件只依赖内核公开契约，不依赖内核内部实现或宿主装配模块。
- 树标签、CLI 格式化等展示行为留在展示扩展中，不混入领域 Handler 或模型。


