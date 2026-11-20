# 架构与扩展设计约定

## 阅读与分层顺序

先理解 Shape：它是领域模型，封装一个图形的状态、结构和行为。ShapeNode 以 Shape 为 value 组成内存文档树，由 Document 管理节点关系、画布、查找及全局约束。

在这些对象之上，Handler 表达可注册的领域方法，Command 像应用 service 一样编排一次用户用例，并组织事务和撤销。SvgReader / SvgWriter 负责内存文档与 SVG 文本之间的持久化映射。

本文先按「Shape → Document → Handler → Command → SVG 读写 → 树展示」说明架构，再汇总调用关系，最后说明注册、扩展发现与依赖装配原则。说明概念时先定义基础对象，再说明依赖它的结构与行为；运行时调用顺序另行展示，不与概念介绍顺序混淆。

## Shape：领域模型

- 持有单个图形的状态，封装内部部件，通过公开方法修改自身；业务复合 Shape 按实际需要声明内部 Shape 成员；普通 SVG 容器的成员关系保存在文档节点树中。
- 保证自身不变量，例如 Box 必须具有有效的矩形和文字；不承担整份文档的全局 id 检查。
- Shape 维护 SVG id，不维护 index、文档归属、文档父节点或通用 children 字段，不提供文档树 insert/remove/relocate。业务复合模型的内部成员默认不成为独立文档节点。
- Shape.identifiers() 声明自身及私有部件占用的全部 id；默认仅自身，复合模型覆写，必须包含根 id、不得重复或非法。声明只读且随模型身份保持稳定，不暴露内部对象或文档关系。
- Handler、Command 和 Document 都不能绕过图形公开方法直接修改其内部状态。Shape 不依赖 Handler 注册表、Command、CLI 或 SVG 解析器。
- 属性规格或模型负责共享的值解析、校验与基础修改规则，避免创建、属性设置和读回各写一套。
- 静态 Shape.parse(id, attributes, readChildren) 提供可覆写的数据构造能力，默认通过属性规格解析文本及默认值。结果 ShapeParseResult 包含构造出的 shape 和仍应作为文档成员的 children；Shape 本身不保存这份文档关系。
- 复合图形通过构造函数或公开工厂生成有效结构。内部部件的访问与修改封装在模型公开方法中，例如 Box.setLabel(value)。

## Document：上层内存文档结构

- Document 是由 ShapeNode 组成的内存 SVG 树，每个节点的 value 是已经构建的 Shape，负责保存、组织和查找这些对象，不承担 SVG 文本解析或按需实例化。
- 文本解析、类型查找与实例构建发生在读入或创建流程中：SvgReader / 创建命令通过图形注册契约构建实例，再将有效子树加入文档。
- `Document.findNode(id)` 和 `requireNode(id)` 统一返回已有 ShapeNode，通过 node.value 获取 Shape，运行时可以是 Box 等具体子类；查找不重新解析文本、不构建新对象。Document 不提供 requireShape/find/shapes 等模型快捷入口，不需要导入具体插件模型类。
- 负责画布信息、文档级树结构操作，以及全局 id 唯一性等跨图形约束；涉及树结构变更的调用必须经过维护文档级约束的公开入口。
- Document 通过 ShapeNode 组织 Shape 抽象，Shape 保持独立于具体 Document 和节点树实现。节点不另设 id 或 index，index 来自父节点列表；父子关系只读公开，由 Document 统一修改。
- insert(shape, parentNode = null, index?) 支持顶层与容器插入并返回节点；relocate/remove 以已有节点为对象。节点父子关系直接读取 node.parent()/children()；Document.children() 只返回顶层节点，indexOf(node) 计算位置。
- Document 编排文档子树变换与属性快照；结构命令使用绑定原文档的结构快照恢复节点身份、层级和顺序。
- Document 在 insert 和结构快照恢复前统一验证节点及私有部件的全部 id，失败不修改关系；节点索引仍仅包含 ShapeNode。Writer 的最终映射校验继续作为独立的持久化保护。
- 不集中实现各具体图形的标题、填充等内部行为；定位目标后，由图形公开方法或相应 Handler 完成操作。
- 不依赖 Command、Handler 注册表、CLI 或 SVG 解析器。

## Handler：领域操作层

- AttributeHandler 是可注册的领域属性方法，通过模型公开接口完成领域操作。注册静态类本身，不创建实例；公开契约为 handlerName、matches、apply、display。
- 负责判断是否适用，并表达操作语义，可组合调用一个或多个模型公开方法。例如 box 的 fill 表示修改框体填充，label 表示修改标题。
- Handler 可以包含领域规则与操作组合；属于模型自身、所有入口必须遵守的结构约束和基础校验，仍由模型保证。
- 不承担 CLI 分词、输出格式、文件 I/O、插件加载或独立的 undo/redo 历史管理。
- 在命令调用边界通过所需模型快照参与局部失败恢复，不要求通用会话事务。处理器部分修改后失败必须恢复修改及保持历史不变，不能再转入默认处理。
- AttributeHandlerRegistry 按启用顺序调用 matches，首个命中即停止，顺序就是优先级；无命中才使用已有模型属性规则。不收集多命中，也不采用冲突拒绝或组合执行。
- 模型类型、属性 key 和别名判断集中在 matches；注册表只保存有序静态类，不维护具体属性映射。matches 和 display 必须只读，静态类不保存单次执行状态。
- SetCommand 定位 Shape 并查询注册表，命中后通过 apply 修改、display 取得领域回显值；null 表示未设置，不触发回退。匹配错误直接传播，执行或展示错误恢复当前模型快照后传播，均不继续尝试后续 Handler。
- 只有需要独立增加、替换或开放给插件的领域操作才抽成 Handler，不把所有模型方法机械地包装为 Handler。

## Command：应用服务层

- 负责命令参数和用例前置条件、定位目标、调用领域操作、组织结果回显。
- 通过公开契约访问当前文档、领域操作和持久化能力，不直接修改模型字段或内部子部件。
- 不实现图形专属业务规则，不在通用命令中不断增加 box 等具体类型分支。
- Command 与执行框架共同组织局部失败恢复和历史：一次用户编辑命令构成一个 undo 单元，调用多个领域方法也必须整体撤销、整体重做，不提前引入通用会话事务框架。
- 普通操作可以直接调用模型公开方法；只有开放为扩展点的操作才需要查询 Handler，不强制每次操作都经过 Handler。
- 命令通过命令类注册机制接入分发与执行流程，由宿主发现并按启用配置装配；启用后参与命令分发和 help 输出，禁用后不注册，执行时按未知命令处理。

- help、undo、redo、exit、quit 是 Client 的框架入口，不实现为 Command 或插件；undo/redo 直接调用 Invoker，历史栈仍保存 EditCommand。init、read、save 和 canvas 等用例命令通过公开服务接口由插件提供。

## SVG 读写：持久化映射层

- SvgReader 将 SVG 表示恢复为领域模型，SvgWriter 将模型映射为 SVG；文件访问负责实际读写，领域修改不通过序列化再解析来完成。
- 负责 XML 语法、元素与属性映射、持久化标记及读入降级策略，不承载 CLI 用例或属性编辑业务规则。
- 读回通过图形注册契约及模型公开的构造、恢复能力生成有效对象；恢复数据不通过编辑 Handler 模拟用户命令，避免触发编辑语义或历史。
- 读入先构建候选文档并完成校验，成功后再替换当前文档；创建子树同样先校验再提交，失败不留下半成品。
- 类型特有的恢复信息通过图形类注册契约提供，通用解析器负责统一流程，接口需明确子元素递归职责。
- SvgReader 通过 ShapeFactory.parse 调用注册类；模型按需调用 readChildren 获得子 Shape，递归和缓存仍由 Reader 完成。复合类型消费必要部件，返回的成员必须是输入子 Shape 的非重复引用；Reader 保留这些成员的完整节点关系。不能静默消费仍带文档子节点的普通容器。
- data-kind 对应已注册类型时使用该类型，未安装则按原标签降级；已安装但结构无效时拒绝读入，不降级或调用编辑 Handler。全输入 id（含根、私有部件和跳过子树）统一检查。
- 当前持久化格式为 SVG，解析与映射围绕现有格式实现。普通 SVG 的多层 g 完整恢复为文档节点树，不自动封装为业务复合 Shape。
- 业务复合模型内部组成的写出通过 SvgShapeMapping 显式映射，Workspace.svgWriter() 注册并供 save 复用；不把模型内部成员伪装为文档子节点。
- 映射只生成模型自身及私有部件，Writer 将文档成员按原顺序追加到映射子元素之后。完整映射树校验 id 后才生成文本和写文件；重复/非法 id、重复 id 属性及同时具有文本和子元素的歧义结果拒绝写出。

## 树展示与装饰链

- 基础树渲染负责节点基础内容、缩进与连线。TreeDecorator 负责在基础行之后追加标签，通过只读的公开信息决定是否追加。
- 使用经典 Decorator 结构：装饰器和基础行渲染器遵循同一渲染接口，装饰器持有被包装对象，先委托渲染，再追加自身标签；不适用时返回被包装对象的结果。
- 当前宿主发现并装配全部插件，按包目录名和包内注册顺序取得装饰器列表，依次包装基础行渲染器；列表从前到后的顺序对应最终标签从左到右的顺序。当前不实现配置注册或白名单。
- 例如列表为 modified-star、box-type，构造结果为 BoxType(ModifiedStar(Base))，最终行尾为 `* (box)`。外层先进入，内层先返回，标签按配置顺序追加。
- 装饰器列表为空时直接使用基础行渲染器，输出与原基线一致。
- 装饰器的状态封装在实例中；新增装饰器不修改内核、基础渲染器或其他装饰器。
- TreeCommand 委托 TreeRenderer，TreeDecorator 通过受保护 tag 追加标签，可通过 onSuccess 维护实例状态。通知仅包含只读节点、冻结的节点列表及画布快照，禁止修改领域状态。
- Client 在 Invoker 成功更新历史后发布 edit/undo/redo/replace/save；DocumentCommand.successKind 声明成功通知类型，画布调整保留文档类历史规则并通知 edit。失败不通知，观察者异常转为展示警告，不把已提交操作误报为失败。不建立通用事件总线或事务。

## 完整调用关系

```text
CLI 输入 → 分词与命令分发 → Command（应用服务）
                              ├─ 通过 Document 定位已有 Shape
                              ├─ Handler → Shape 公开方法
                              ├─ 普通操作直接调用 Shape 公开方法
                              ├─ 文档结构操作调用 Document 公开入口
                              └─ 读写用例调用文件访问与 SVG 映射

持久化路径：
SVG 文件 ⇄ 文件访问 ⇄ SvgReader / SvgWriter ⇄ Document（内部为 Shape 树）

内存组织关系：
Document（画布、节点树、全局约束）
  └─ ShapeNode（value、只读父子关系；无独立 id/index）
       ├─ value: Shape（状态、领域行为、自身约束）
       └─ children: ShapeNode[]（Document 维护）

业务复合 Shape 可直接持有内部 Shape 成员，不持有 ShapeNode。

装配路径：
宿主 → 注册 Shape 类、Handler、Command、TreeDecorator
```

## 模型扩展与注册

- 新增模型通过具体 Shape 类及按需的 Handler 接入。
- 具体 Shape 类的静态描述与构造能力承担图形类型注册契约；ShapeClass 仅是 ShapeFactory 文件内的类型约束，不导出。使用侧通过 has/definition/create 获取支持信息、只读规格和实例，不能查询构造函数。
- 课程中的 ShapeProvider 对应图形类型注册契约，由具体 Shape 类承担；交付文档须明确对应关系。
- ShapeFactory 负责注册、查找与创建；具体图形的选择和注册放在宿主装配侧，工厂不自行导入、枚举插件图形。
- 普通图形无需专门 Handler。特殊领域操作通过 Handler 独立注册；模型不依赖其处理器，处理器可依赖模型公开接口，两者可以同包维护。
- Command 注册命令名、参数规则及执行能力；TreeDecorator 注册树行标签的生成能力。

## 扩展发现与启用配置

- 宿主从应用 plugins/ 的直接子包自动发现 Shape、Command、Handler 和 TreeDecorator，按目录名稳定排序并全部装配；新增包不修改内核或发现逻辑。六种基础图形由 plugins/shapes 提供，17 个具体命令形式由 plugins/commands 提供；两包随应用分发，与其他插件使用同一发现、激活和校验路径。
- 本阶段不实现配置注册、白名单、禁用或 options；这些不是当前验收范围。目录缺失或无包时仅保留 help、undo、redo、exit、quit 五个框架入口；不隐式补入图形或用例命令。
- 包通过 package.json 的 name、main 和 contributes 声明贡献，入口具名导出 activate(context) 函数，同步或异步均可。贡献名称必须与实际暂存注册集合一致，跨插件同类重名拒绝；命令包内部仍可注册多个互斥形式。
- 公共 ExtensionContext 只开放四种注册方法；registerShape 可附带 SVG 映射。宿主先暂存，再构建候选注册表、writer、装饰链和 Client，全部校验成功才接纳。单包失败丢弃其全部贡献及映射，报告错误并继续，保留先前有效会话。激活完成后上下文关闭。
- 插件目录名不限定贡献类别，同包可同时注册模型、Handler、命令和装饰器。Handler 通过 registerAttributeHandler 接入 Workspace 注册表，由 SetCommand 查询和调用；activate 只声明贡献，不执行用户用例，也不要求图形先于命令注册。
- 代码装配 assemblePlugins 与目录发现共用暂存和校验路径；插件不得依赖任意外部副作用能被回滚。

## 依赖与装配边界

- 内核定义公开领域抽象和扩展契约，通过契约调用扩展，不导入具体插件。
- 宿主和扩展的公共导入入口为 `src/backend/index.ts`；ShapeNode 只导出类型，节点构造及关系存储不作为扩展接口。
- ShapeFactory 初始为空；宿主只构造基础服务，main 使用自动发现宿主，具体能力由插件 activate 注册，不保留 defaults 直接注册路径。Client 接收 Workspace，Workspace 接收工厂、文件访问、SvgReader、SvgWriter、AttributeHandlerRegistry 和 TreeRenderer，不在内核创建默认服务。宿主从空 Handler 表和装饰链开始装配贡献，Invoker 不依赖 Workspace。
- 插件只依赖内核公开契约，不依赖内核内部实现或宿主装配模块。
- 宿主负责加载和注册全部发现的插件；代码装配与自动发现共用注册、声明校验及失败隔离路径。配置装配留待后续交付范围重新确定。
- 树标签、CLI 格式化等展示行为留在展示扩展中，不混入领域 Handler 或模型。


