# ADR：树装饰、成功通知与全部插件发现

日期：2026-11-20。状态：已实现，等待验收。用户调整当前范围：不做配置注册，自动发现并装配全部插件；先完成架构，再实施正式插件。

## 树渲染与状态

TreeLineRenderer 统一基础行与装饰器的 render(node, canvas)。BaseTreeLineRenderer 负责画布、标签和内联属性，TreeRenderer 负责节点递归、缩进与连线；TreeCommand 只定位根并组织 CommandResult。私有部件不成为文档树行。

TreeDecorator 是经典装饰器：持有内层渲染器，先渲染，再由 tag 返回可选标签。列表 [A, B] 构成 B(A(Base))，标签显示 A B；null 或空字符串不追加。类通过 decoratorName 稳定命名，构造时检查重复名称。会话创建独立实例，无标签时保持既有输出。

不建立通用事件总线。Client 在 Invoker 成功维护历史后通知当前装饰器 edit、undo、redo、replace 或 save；查询及失败不通知。DocumentCommand.successKind 默认 replace，Save 返回 save，CanvasResize 返回 edit，历史分类保持原规则。通知包含冻结的事件、节点列表和画布尺寸，只读引用不得用于修改模型；树节点值仍是原模型，不声称这是隔离不可信代码的安全边界。

onSuccess 的异常逐项捕获并作为 CommandResult 的展示警告，后续观察者仍收到通知。已经成功的领域操作和历史不因观察者失败而反转。正式 modified-star 的内容比较、祖先传播等业务策略留到该插件实现，不在内核提前固定；本次测试装饰器仅验证状态可维护且实例隔离。

## 全部发现与加载

默认入口以应用根 plugins/ 为发现目录，扫描直接子包的 package.json，按目录名稳定排序。仅加载具有包清单的目录或链接，main 缺省为 index.js；不遍历 node_modules 或包内依赖，不硬编码具体插件名。包入口支持当前运行环境能加载的 JS/TS。目录不存在或没有包时，以基础宿主启动。

每个包声明 name、main、contributes，入口默认导出提供 activate(context)，支持异步激活。contributes 分类为 shapes、commands、attributes、decorators，分别使用模型 type、命令 command、Handler.handlerName、Decorator.decoratorName，未声明类别为空。名称非空，声明列表不重复，声明集合须与实际暂存贡献一致。包内部允许现有命令协议的多个互斥形式，共用一个 command 名称；跨包重名仍拒绝。

ExtensionContext 定义在内核公共入口，插件不依赖宿主实现。它只提供四个注册方法，registerShape 同时可提交附属 SVG 映射。不提供 Workspace、Client 或注册表，不允许激活结束后继续注册。形状类和命令类分别复用现有注册契约，Handler 注册静态类，Decorator 注册构造类。

## 声明校验时机与原子装配

1. 发现阶段解析包元数据，检查入口是否存在。入口确实不存在才报告 plugin not found；模块内部依赖失败报告 plugin failed to load，不能混淆。
2. 加载模块，检查默认导出，然后调用 activate，将注册暂存到当前包独立列表。激活异常丢弃列表，finally 关闭上下文。
3. 激活成功后比较声明集合，随后将已接纳贡献与当前包一起构建独立候选工厂、writer、Handler 表、Decorator 链和 Client。复用现有注册校验，拒绝无效类、同类重名和装饰器构造失败。
4. 所有步骤成功才接纳候选会话；失败保留上一份会话，丢弃全部当前包注册及映射，继续后续包。所有候选都发生在用户命令开始之前，不需要历史或会话事务。

代码入口 assemblePlugins 与目录入口 createDiscoveredHost 通过同一 assembleSources 完成暂存、声明检查和候选构建。插件任意外部副作用、对共享静态对象的越权修改不属于注册回滚承诺，激活应只声明贡献，构造器只初始化实例状态。

单包失败统一输出 error，并继续启动：入口缺失、无默认导出、依赖加载失败、激活失败、声明不一致及重复注册均有独立测试。包清单 JSON/结构非法也单独报告。注册表顺序采用发现顺序及包内注册顺序；Handler 首次匹配与 Decorator 标签顺序据此确定。

## 模型私有 id

Shape.identifiers() 只声明占用的字符串 id，复合模型递归汇总部件声明，不公开内部对象。Document.insert 在修改前检查候选与全部现有节点模型的声明；结构恢复同样在清空关系前验证完整快照。删除通过当前模型集合自然释放占用，不维护第二份可变索引。Writer 仍独立验证实际映射，以防插件生成错误 id。

## 当前交付边界

不实现配置文件、白名单、禁用、options 或正式业务插件。Phase 2 的双配置装配验收因此明确暂缓；当前完成的是无配置全部发现及代码装配的一致路径。用真实 Node/tsx 进程验证临时磁盘包，避免测试转换器替代原生加载，覆盖 Windows 带编码字符的临时路径。

用法见 [plugins/README](../../plugins/README.md)，验证与提交记录见[剩余架构记录](../update/20261120_REFACT_EXTENSION_ASSEMBLY.md)。
