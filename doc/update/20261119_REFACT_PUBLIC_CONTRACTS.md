# 第三批：公开契约与宿主装配

按接口、装配、注入、验收四步推进，每步检查后独立提交。

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

## 后续步骤

第四步统一验证扩展边界与 CLI 回归，补齐架构说明，完成后停在第三批验收点。
