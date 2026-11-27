# ADR 1 · 属性处理器与局部撤销

`SetCommand` 通过文档节点定位现有 `Shape`，再调用 `Receiver.set`。`Receiver` 只解析一次匹配：写入前取旧展示值，写入后调用 `Shape.validate()`，再用同一匹配取新展示值。处理器在 `matches` 判断类型及属性语义，通过模型公开入口修改私有部件。Box 的处理器经 `frameShape()`/`captionShape()` 读写外观、几何与标题，几何写入后由 `layoutLabel()` 重排标题；静态处理器只声明行为。

创建流程复用同一个内部写入：`Receiver.createShape` 按 id 构造候选，逐项写入后统一校验一次，候选不进入文档；创建失败不留下图形或历史。普通图形没有处理器命中时，编辑与创建都使用模型自身的属性规则。

注册顺序决定优先级，首个匹配负责整个修改。只有没有匹配项时才使用模型规则。命令在写入前保存图形快照；Box 的快照包含矩形、文字和自身。任一调用失败，恢复快照并传播错误，Invoker 保持原来的撤销与重做记录。成功一次入栈一次，撤销恢复快照，重做再次执行原命令。

通用测试覆盖首个命中、属性回退及处理器部分修改后失败。Box 会话测试验证 `fill` 与 `label` 分别撤销和重做。 [通用测试](../../cli/test/backend/command/impl/SetHandlerCommand.test.ts) [Box 会话测试](../../cli/test/plugins/BoxSession.test.ts)
