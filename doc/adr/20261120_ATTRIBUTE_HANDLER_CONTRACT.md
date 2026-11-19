# ADR：静态属性处理器与有序匹配

日期：2026-11-20。状态：已实现，第四批待验收。

## 背景

默认 Shape.set/display 按属性规格操作当前模型的值。特殊领域属性可能修改私有部件，或使用普通属性表中没有的别名；需要独立注册这些行为，同时保持 Phase 1 的默认属性与回显。

## 决定

| 议题 | 决定 | 理由 |
| --- | --- | --- |
| 注册形态 | 注册静态 Handler 类，不实例化 | 当前操作无实例状态，沿用类注册形式，无需额外实例或基类 |
| 稳定标识 | 使用 handlerName | 支持重复校验及后续贡献声明，避免与 Function.name 冲突 |
| 适用条件 | matches(shape, key) 统一判断实例、属性和别名 | 匹配只有一个来源，内核不枚举具体属性，也不靠 SVG 标签区分模型 |
| 重叠处理 | 按注册顺序首次命中，后续项不再匹配 | 顺序就是优先级，允许前项覆盖后项；替代此前的多命中拒绝方案 |
| 默认处理 | 零命中才调用 Shape.set/display | 不将普通属性机械包装为 Handler，保持既有行为 |
| 回显 | display(shape, key) 返回展示文本或 null | 支持领域属性与别名，null 表示未设置，完整 CLI 文案仍由命令生成 |
| 恢复与历史 | 命令捕获模型快照，Invoker 保持 Command 历史 | 一次 set 是一个撤销单元，无需通用会话事务 |

## 契约和调用位置

公开入口为 src/backend/index.ts，导出 AttributeHandler 接口及 AttributeHandlers 类。接口描述静态部分，方法签名如下：

```ts
interface AttributeHandler {
  readonly handlerName: string;
  matches(shape: Shape, key: string): boolean;
  apply(shape: Shape, key: string, token: string): void;
  display(shape: Shape, key: string): string | null;
}
```

宿主调用 AttributeHandlers.register(HandlerClass)，Workspace 接收注册表并通过 attributeHandlers() 提供它。register 校验函数形态、非空名称及三个方法，同名报 duplicate attribute handler；缺失 apply 时不能误用类继承的 Function.apply。无效声明报 attribute handler must be a static class with handlerName, matches, apply and display，原表保持不变。注册表的唯一匹配入口为 AttributeHandlers.resolve。

SetCommand.execute 经 requireNode(id).value 取得原 Shape，将其与原始 key 传给 resolve；命中后直接调用该静态类的 apply/display，无命中调用模型默认规则。原 key 保留在回显中；例如 label 和 title 可由同一 Handler 匹配、执行相同模型方法，不在内核建立别名表。

默认宿主注册表为空，不注册几何、外观或 text 等通用属性。当前仅 SetCommand 使用该扩展点；创建、SVG 读入、move/scale、树结构操作不经过它。正式 Box 与发现/配置装配不属于本批。

## 状态和失败约定

- Handler 只通过 Shape 公开方法修改目标及其封装部件，不持有 Workspace、Document、ShapeNode 或历史；模型和私有部件不反向依赖 Handler。
- matches/display 必须只读，静态类不保存单次执行状态。支持判断应依据实际模型能力或实例，普通 Group 和同为 g 的复合模型不能仅按标签判断。
- resolve 首次命中即返回；后续配置装配应按最终启用顺序注册。配置加载、动态禁用及插件级暂存回滚留到第七批。
- 匹配抛错直接传播，不尝试后续项。命中后执行或展示失败，也不尝试后续项或默认规则。期望向用户报告的领域错误使用公开 EditorError，由现有 App 错误入口输出并继续运行；程序错误仍按现有规则传播。
- 匹配成功或零命中后，SetCommand 调用 shape.capture()，在同一个 try/catch 中取得旧展示值、执行修改、取得新展示值及计算结果；全部成功才替换撤销记录，异常时恢复本次快照。
- undo 直接恢复快照并使用已保存旧展示值，不重新查询 Handler；redo 再次执行原命令，重新使用当前注册顺序。失败保持历史及之前有效撤销记录不变。
- 复合模型 capture() 覆盖私有部件。恢复范围为目标模型及其拥有的部件，不包含文档结构、路径、文件系统或其他外部对象，不构建通用会话事务。

## 验证

注册表测试覆盖顺序、首个命中停止、无效声明、重复名称、无命中、隔离和匹配失败。SetCommand 测试覆盖领域 fill、label/title 别名、同标签不同模型、默认回退、多部件整体撤销、部分失败、展示失败、历史保留及重试；公共入口测试使用只导入 SDK 的静态测试扩展；App 回放验证领域错误后仍能继续 undo/redo。

完整记录见 [第四批实现记录](../update/20261120_REFACT_ATTRIBUTE_HANDLERS.md)。
