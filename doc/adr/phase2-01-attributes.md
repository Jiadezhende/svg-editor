# ADR 1 · 属性处理器与局部撤销

`SetCommand` 通过文档节点定位现有 `Shape`，再把图形及属性名交给 `AttributeHandlerRegistry.resolve`。处理器在 `matches` 判断类型及属性语义，通过模型公开方法修改私有部件。Box 的处理器分别调用 `setFill` 与 `setLabel`，静态处理器只声明行为。

注册顺序决定优先级，首个匹配负责整个修改。只有没有匹配项时才使用模型规则。命令在 `apply` 和 `display` 前保存图形快照。Box 的快照包含矩形、文字和自身。任一调用失败，恢复快照并传播错误，Invoker 保持原来的撤销与重做记录。成功一次入栈一次，撤销恢复快照，重做再次执行原命令。

通用测试覆盖首个命中、属性回退及处理器部分修改后失败。Box 会话测试验证 `fill` 与 `label` 分别撤销和重做。 [通用测试](../../test/backend/command/impl/SetHandlerCommand.test.ts) [Box 会话测试](../../test/plugins/BoxSession.test.ts)
