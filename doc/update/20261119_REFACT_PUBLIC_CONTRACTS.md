# 第三批：公开契约与宿主装配

按接口、装配、注入、验收四步推进，每步检查后独立提交。

完成日期：2026-11-19。前三步提交为 `6c4d81d`、`b11eb67`、`1a37ed1`，第四步提交包含最终验收和文档更新。

## 决策记录

| 议题 | 决定 | 理由 |
| --- | --- | --- |
| 文档查询 | 统一返回 ShapeNode，以 value 读取模型 | 保留节点和模型身份，减少重复公开方法 |
| 图形注册 | 直接注册具体类，ShapeClass 仅作内部约束 | 静态定义和构造能力已经承担课程 ShapeProvider 的职责 |
| 默认选择 | 宿主注册图形与命令，工厂初始为空 | 内核不依赖具体扩展，默认 CLI 仍有明确的组合根 |
| 服务注入 | Workspace 接收现有方法的结构类型，Client 接收 Workspace | 能替换依赖，不增加服务框架或额外包装类型 |
| 历史与恢复 | 保持 Command 历史栈及局部快照 | 本批不恢复通用事务，不提前实现 Handler |

## 第一步：公开接口收敛（已完成）

- Document 只通过 findNode/requireNode 定位节点，模型经 node.value 访问；删除模型快捷查询、父节点转发及容器定位包装。
- children() 仅返回顶层节点，节点自身只读公开父子关系；保留结构入口、indexOf 及批量用例实际使用的预检查，checkInsert 转为私有。
- ShapeClass 仅用于工厂内部注册约束；使用侧保持 has/definition/create，不返回构造签名。
- src/backend/index.ts 是宿主和扩展的公共入口。ShapeNode 只导出类型，不公开节点构造、关系存储或内置具体实现。
- 命令承担目标不存在或不能接收成员的用例前置检查，Document 结构入口继续验证模型规则；原 CLI 错误内容与顺序保持兼容。
- AGENTS.md 已同步节点查询及局部快照边界，不引入通用事务。

验证：类型检查通过；43 个测试文件、437 个测试通过。测试扩展仅使用公共入口即可定义模型、注册、创建及读取文档节点；编译检查禁止导入 ShapeClass 或公开构造 ShapeNode。

## 第二步：宿主选择默认能力（已完成）

- ShapeFactory 初始为空，不再导入或枚举具体图形。src/host/defaults.ts 选择并注册默认图形和内置命令，保持原 help 的文件名排序顺序。
- main.ts 只连接默认装配和控制台 IO，不承担扩展类型查找或命令实现。
- GroupCommand 经工厂创建普通分组，命令实现不再导入具体 Group 模型。
- 为保证本步独立可运行，Workspace 先接收宿主提供的工厂，Client 接收已构造的 Workspace；文件与 SVG 服务在第三步继续迁出。
- 测试的默认环境改为显式使用宿主装配，裸工厂测试验证空注册表。课程 ShapeProvider 由具体类的静态定义和构造能力承担，不额外包装对象。

验证：类型检查通过；44 个测试文件、440 个测试通过，包括真实 CLI 回放、默认 help 顺序、模型与命令默认集合及独立会话。

## 第三步：内核接收依赖（已完成）

- Workspace 的构造参数接收工厂、文件访问、reader 和 writer；文件及 SVG 能力直接取现有公开方法的结构类型，不增加服务框架或包装类。
- 宿主负责创建 SvgFile、SvgReader 和 SvgWriter，reader 与创建命令使用同一工厂。Client 接收 Workspace，Invoker 仍独立管理命令历史。
- ReadCommand 不再临时构造 reader；SaveCommand 复用注入 writer，包含装配后注册的映射。
- 注入内存文件、仅注册测试模型的工厂和替换解析器，验证真实 create/read/save 路径；读写失败保留原文档、路径及可撤销历史。

验证：类型检查通过；45 个测试文件、442 个测试通过。

## 第四步：统一验收（已完成）

- test/support/PublicExtension.ts 只从公共入口导入模型与命令契约。宿主测试显式注册模型和命令，验证 help、执行、多轮 undo/redo、模型和节点身份，以及未注册实例按未知命令处理。
- 编译检查继续验证 ShapeClass 不公开、ShapeNode 不可从公共入口构造，以及已删除的查询和内部预检查不可调用。
- 源码检查确认 backend 不导入 host；Factory、Document、Workspace、Client 和内置命令不导入具体图形；默认文件和 SVG 服务只由宿主构造。
- 更新 AGENTS.md 和 doc/README.md；旧 Phase 1 设计明确标为历史记录。

最终验证：npm run typecheck 通过；npm test -- --reporter=dot 通过，45 个测试文件、443 个测试通过；git diff --check 通过。包括默认 help 顺序、真实 CLI 回放、读写计数与映射、属性和结构撤销、局部失败恢复及服务替换。

第三批完成并停在验收点。Handler、Parser 职责调整、装饰链及插件发现按后续批次实施；本批没有增加正式业务插件，不自动推进第四批。
