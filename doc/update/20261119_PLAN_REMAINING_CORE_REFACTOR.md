# 后续内核重构计划：以 ShapeNode 架构为基线

更新日期：2026-11-19。依据 AGENTS.md 及《文档节点树与 Shape 职责分离》。本计划替代先前基于 Shape 通用 children、parent 和 StructureEdit 的后续安排，不回退当前节点架构。

当前进度：第二批已由用户验收，代码与测试提交为 `5b62a44`；第三批 ShapeFactory 使用侧接口调整及两处调用迁移已阶段性提交为 `ff139d7`。剩余工作先收紧公开 API，再完成宿主注册迁移和依赖注入。

## 当前基线与边界

- Shape 保存 SVG id、属性及领域行为；业务复合模型按需封装内部 Shape 成员，自行扩展行为和属性快照。Shape 不持有文档节点、父子关系、文档归属或通用 children。
- ShapeNode.value 引用 Shape，parent/children 只读；Document 管理关系、id 索引、节点归属及全局约束，index 由兄弟列表计算。
- 普通 SVG 的多层 g 是文档节点；业务复合模型内部部件默认不是独立节点，不能直接通过 Document.requireShape 定位。
- 分组、解组仍是 Command 编排的结构用例；Document 只提供节点结构入口及文档子树变换，不接管分组用例。
- 已有 DocumentStructureMemento、组合式 UndoRecord、模型属性快照及文档子树变换失败恢复；不建设通用会话事务。StructureCommand、RelocateCommand 已删除，所有具体编辑命令直接继承 EditCommand。
- 已有 SvgShapeMapping、SvgElement 和 Workspace.svgWriter()；save 复用会话 writer。复合模型写出不伪造文档节点。
- 本次复核：npm run typecheck 通过；npm test -- --reporter=dot 为 42 个测试文件、436 个测试通过。

## 第二批：三类命令与局部撤销（已验收，提交 5b62a44）

详细实现及能力边界见 [第二批记录](20261119_REFACT_UNDO_REDO_SIMPLIFICATION.md)。

- 命令保留查询、编辑、文档三类；删除专用结构与迁移父类，结构命令通过组合式 UndoRecord 复用局部快照恢复及撤销回显。
- EditCommand 保留 execute/undo，Invoker 的两个栈继续保存 EditCommand；redo 重执行原命令，成功后才更新历史。
- set/move/scale 保留属性撤销记录；结构撤销不覆盖后来独立修改的属性。
- 删除 Workspace 通用事务、提交回调、附加保护及会话快照，Invoker 不依赖 Workspace，不新增执行结果或历史项模型。
- 保留模型自身校验、子树变换失败恢复和结构快照的完整预校验。不承诺对任意扩展代码自动回滚整个会话。

## 第三批：公开扩展契约与依赖注入（部分完成）

目标：明确插件可以依赖的领域、节点读取、命令及持久化边界，不在这一批引入 Handler。

已完成的 Factory 接口调整：

- 装配侧使用 register(ShapeClass)；使用侧仅通过 has(type)、definition(type)、create(type, id, values) 判断支持、读取规格及取得实例。lookup 改为私有，删除返回构造函数的 find。
- definition 返回已注册类的只读静态规格视图，包括 type、params、paint、content、attributes、attribute，不包含构造签名或注册校验用的 anchor。不创建包装对象，不新增 ShapeDefinition 或 Provider 类型。
- CreateCommand 继续处理 CLI 语法与参数值，SvgReader 继续处理 XML、默认值和未知元素跳过；两者统一通过 factory.create 创建模型，不再直接 new 注册类。
- 工厂只负责查找和构造，属性及模型结构有效性由 Shape 保证；注册校验仍检查类型名、重名及锚点。已验证工厂返回实例被直接加入文档，保持创建撤销重做和 SVG 警告行为。

尚待完成：

- ShapeClass 仅作为 ShapeFactory 文件内的注册参数及存储类型，不再 export，也不从公共入口导出；注册方直接传入具体图形类，通过参数推导进行契约检查，不要求显式引用这个类型，不另建 Provider 包装。
- Document 按 id 查询统一返回 ShapeNode：保留 findNode(id) 的可空查询和 requireNode(id) 的必须存在查询，删除返回模型的 find(id)、requireShape(id)。调用方通过 node.value 取得已有模型，不新增其他等价快捷方法。
- 删除 shapes() 模型列表快捷入口，统一使用 nodes() 遍历；read/save 的文档元素统计改用 nodes().length，不统计复合模型映射出的内部 SVG 元素。
- 读取节点父子关系统一使用 node.parent()/children()；删除 Document.parent(node)，Document.children() 只读取顶层节点，不再接收父节点参数。保留 indexOf(node)，以支持不额外保存 index 的根级及组内定位。
- 删除 requireChildTarget 等目标定位包装，Command 使用统一节点查询完成用例前置检查；Document.insert/relocate 仍调用模型公开规则保证结构有效，保留现有 CLI 错误内容及检查顺序。
- 按实际调用收缩预检查方法：仅内部使用的 checkInsert 设为 private；分组、解组批量预检查实际使用的 checkRemove/checkRelocate 暂保留，不为接口数量机械删除必要能力。
- 建立最小公开入口，导出 Shape、属性规格、ShapeFactory、只读 ShapeNode、上述 Document 能力、命令契约及必要的持久化映射契约；不导出内部类型、关系弱映射、节点写权限或兼容别名。
- 工厂 create 仍返回尚未加入文档的 Shape，Document.insert 接收模型并返回节点；工厂不负责创建 ShapeNode 或维护文档关系。
- ShapeFactory 移除内置具体图形导入和枚举，由宿主注册；图形类承担课程 ShapeProvider 所对应的类型描述和构造契约。
- Client、Workspace 接收宿主装配的工厂、文件访问及 SVG 读写能力；save 持续复用注册过映射的 writer。具体依赖的创建和默认内置集合只放在宿主。
- 保持默认 CLI 行为及 help 顺序；现有模型行为仍直接通过模型公开方法调用。
- 优先完善已有接口与组合装配，不为形式对称新增执行结果、历史项或服务框架；保留当前 Command 历史模型和局部快照边界。

验收：空工厂、默认宿主、替换文件服务及 writer 的测试；外部测试扩展只从公开入口导入；禁止内核导入插件和宿主、插件导入关系存储实现。

API 收敛验收：生产代码及公开入口不再引用导出的 ShapeClass 或模型查询快捷方法；set 等领域命令通过 requireNode(id).value 操作模型，结构命令继续操作节点。覆盖可空查询、缺失 id、容器目标错误、节点身份、父子读取、read/save 计数及 CLI 回显兼容。实施时同步 AGENTS.md 中 requireShape 及相关公开方法的旧说明，不保留双轨接口。

当前 Factory 构造函数仍注册六个内置类型，Workspace 仍创建默认服务；这些仅在本批剩余装配调整中迁出，不把本次接口调整视为第三批全部完成。

## 第四批：独立引入 AttributeHandler

目标：新增可独立注册的领域属性行为，不把文档关系和内部部件寻址重新塞回 Shape。

- 提供稳定注册名、只读 handles(shape, attribute) 和执行 apply 的契约。处理器直接接收已有 Shape 引用，通过模型公开方法修改内部部件，不要求内部部件具有可寻址文档节点。
- SetCommand 负责定位、参数、调用及回显。多个处理器命中时明确拒绝；没有命中才调用现有 Shape 属性规则；处理器执行失败不转入默认处理。
- 处理器提供领域属性的前后回显信息，避免强迫 label 等便捷属性出现在模型基础属性表中。
- 在 SetCommand 的处理器调用边界使用模型快照，保证一次 set 是一个撤销单元；处理器部分失败先恢复目标模型再抛错，不改变历史；处理器不拥有独立历史，不进行文件访问或插件加载。
- 普通属性无需专门 Handler，不机械包装既有 Shape 方法。

验收：普通属性回退、未知属性、处理器冲突、复合模型多部件修改的单次撤销及重做、部分修改后抛错，以及模型内部部件仍不进入文档索引。

## 第五批：完善 SVG 解析、模型构建与复合映射

目标：基于现有映射完善读写扩展，保持领域模型与 XML、节点关系独立。

- Parser/SvgReader 负责 XML 文本解析、类型选择、递归和候选文档编排；Shape 类提供可覆写的数据构造/解析能力，通用属性值处理复用 AttributeSpec。Shape 不接收 XML 库对象，不依赖 Parser、ShapeNode 或 SvgElement。
- 明确两种递归结果：普通 g 的子元素创建独立文档节点；已识别业务复合类型的内部元素由类型构造能力解释为私有部件，不先注册进 Document 再移除。
- 类型注册契约声明子元素作为文档成员或内部构造数据的处理规则。Parser 只递归一次，不在通用流程中判断 box 等类型名，也不要求 Shape 增加通用 children。
- 保留独立 SvgShapeMapping/SvgElement 写出路径；图形类承担模型构造，持久化映射承担 SVG 元素、属性和标记映射，不把两者合并成模型字段。
- 根据持久化标记恢复已注册业务类型；插件缺失时按原 SVG 标签降级为普通节点树。插件已注册但结构无效时拒绝整个读入；成功前不替换当前文档，不经过编辑 Handler。
- Document 索引只管理文档节点；另在读写持久化边界校验实际 SVG 中包括内部映射元素在内的 id 唯一性，拒绝内部部件与普通节点的输出冲突。写出校验完成后才进行文件写入。
- 保持普通 SVG 往返、警告顺序、save 按文档节点统计元素数、多个映射命中报错及映射不能覆盖已有文档子节点的行为。

验收：普通多层 g 往返；复合类型写出和读回后仍为单个业务节点；缺插件降级；部件缺失或类型错误拒绝；输出内部 id 冲突；失败保留原文档、路径和已有文件；read 不产生编辑历史。

## 第六批：树行渲染与经典装饰链

目标：展示直接读取节点树，领域模型不承担节点关系展示。

- 基础渲染器负责根节点与文档节点的行内容、缩进和连线。渲染上下文包含只读 ShapeNode、node.value 和画布信息，不扫描业务模型私有部件。
- 装饰器与基础行渲染器使用同一接口，持有被包装对象，先委托再追加标签；列表顺序对应最终标签从左到右的顺序。
- 编辑、undo、redo、文档替换和保存成功后发送只读通知；失败操作不发布成功通知，展示订阅者失败不破坏已经完成的编辑。
- 实例管理各自状态；无装饰器时输出逐字节兼容。业务复合模型默认只有其文档节点的一行，不为隐藏部件自动生成树行。
- 本批仅完成机制及测试装饰器，不实现正式 modified-star 或 box-type 插件。

验收：无标签基线、两个独立标签的顺序、不适用时原样返回、实例隔离、保存及失败操作通知、复合模型无伪造部件节点。

## 第七批：宿主发现、配置与原子装配

目标：四类扩展及图形附属持久化能力共用可靠的装配流程。

- 根据模块和贡献声明发现 Shape、Command、Handler、TreeDecorator；代码装配和配置装配共用暂存注册、声明校验、排序和失败回滚路径，不硬编码具体插件。
- 非空分类白名单只按名单顺序装配；未配置或为空时按模块及模块内注册的稳定顺序装配全部候选；显式禁用完全跳过。
- 支持 options，按配置文件目录解析相对模块。重复名称、声明不符、缺模块、缺默认导出、激活或求值失败分别报告并继续加载；配置无效时使用默认内置能力。
- 图形附属 SVG 映射与其他注册一起暂存、提交和回滚；插件激活失败不能在会话 writer 中遗留映射，不能只回滚四个注册表。
- 启用命令参与分发和 help，禁用后视为未知命令；同名命令的既有多语法形式保持兼容。

验收：全部加载失败路径、注册及附属映射回滚、白名单和顺序、命令启停、相同插件集合和 options 下代码与配置装配输出逐字节一致。

## 推进与交付

- 第二批已验收并提交；第三批 Factory 接口已阶段性提交，后续按“公开 API 收敛 → 宿主注册迁移与依赖注入 → 公共入口及边界验收”推进，不连续推进未验收批次。
- 正式 box、stats、dir、modified-star 等业务插件和 VSCode 实践仍不在本计划范围；使用独立测试扩展验证机制。
- 不修改旧批次历史记录来掩盖架构变更；仅在用户明确要求时提交，不自动打标签或发布。
- 每批运行相关测试、全量测试和类型检查；更新架构依赖图、ADR 及公开接口说明，后续基线以当批实际结果为准。
