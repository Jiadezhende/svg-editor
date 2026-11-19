# ADR：SVG 递归编排与复合模型数据构造

日期：2026-11-20。状态：已实现，等待第五批验收。

## 背景与决定

原 Reader 直接解析属性、构造对象并立即递归插入 Document，只能还原普通 SVG 节点树。Writer 已能通过映射保存私有部件，但读回时会把部件变成普通文档节点。保留 Reader 和 Writer 两个持久化组件，不增加通用 Parser 框架。

| 议题 | 决定 | 理由 |
| --- | --- | --- |
| XML 与领域数据 | Reader 处理 XML、文本提取、类型选择及递归；Shape 解析领域值并构造对象 | 模型不依赖 XML 库，也不通过编辑 Handler 恢复数据 |
| 数据构造 | Shape.parse(id, attributes, readChildren) 返回 ShapeParseResult | 静态默认实现可复用，特殊类可覆写，不公开注册构造函数 |
| 递归责任 | readChildren 由 Reader 提供并缓存 | 默认叶子保持不遍历子元素的行为，容器和复合类型按需请求，重复请求不重复构造 |
| 内部与文档组成 | 模型消费私有部件，返回仍需成为节点的 children | 不靠 acceptsChildren 混淆私有组成与接收成员的能力，不给 Shape 增加通用 children 状态 |
| 类型选择与降级 | 已注册 data-kind 优先，否则使用原标签 | 插件缺失可保留普通 SVG 结构，内核不识别具体插件名 |
| 非法已安装类型 | 拒绝整次读入，不降级 | 避免无效结构掩盖错误或生成不完整复合模型 |
| 写出组合 | 独立 SvgShapeMapping 生成私有组成，Writer 追加文档成员 | 不扫描私有字段，也不静默丢失可嵌套成员 |
| id 校验 | 读入检查全部显式输入 id，写出检查完整最终映射树 | 文档节点索引看不到私有部件，不能仅依赖 Document 的节点 id 检查 |

## 公开契约

ShapeFactory.create(type, id, values) 继续接收已解析属性，供创建流程使用。新增 parse(type, id, attributes, readChildren) 通过内部注册类调用 Shape.parse，不向 definition 暴露解析函数或构造签名。ShapeClass 仍是内部约束。

```ts
interface ShapeParseResult {
  readonly shape: Shape;
  readonly children: readonly Shape[];
}

// Shape 的静态方法；readChildren 可省略，默认为空列表。
parse(
  id: string,
  attributes: ReadonlyMap<string, string>,
  readChildren: () => readonly Shape[],
): ShapeParseResult;
```

attributes 是 Reader 从 XML 提取的普通字符串数据，已处理属性空白及 content 文本映射。默认 parse 通过 protected parseValues 复用属性规格、缺失值默认规则和构造函数校验；默认容器保留 readChildren 的全部结果，默认叶子不调用它。特殊类同步请求子 Shape，验证部件并通过公开构造能力生成模型；不接触 Element、SvgElement、ShapeNode 或 Document。

返回 shape 必须保留传入 id。children 可以筛选、重排输入对象，但不得重复或包含自行生成的对象；Reader 根据对象引用恢复其原有后代关系。未返回的对象视为模型消费的部件。若消费的是仍带文档后代的普通容器，Reader 拒绝，防止丢失关系；具有复杂内部组成的部件应自身建模为复合 Shape。模型不会取得 Reader 的关系存储。

## 读入和提交

1. Reader 解析 XML 和画布，校验根及所有后代的显式 id，包括跳过的未知元素和私有部件；重复或非法 id 一律拒绝。Shape.checkId 与模型构造复用同一规则。
2. 为实际读入且缺 id 的元素补号，避开全文显式 id 及此前补号，保持原有先序补号与警告。
3. 通过已注册 data-kind 或原标签选择类型，向模型提供普通属性和 Reader 持有的递归函数。未知标签连同子树跳过并警告；未知 data-kind 按原标签读入，不硬编码插件类型。
4. 模型构造及引用契约全部通过后，将返回的候选关系组装进新 Document，继续经 Document 检查节点所有权、能力及全局约束。ReadCommand 仅在 read 成功后替换当前文档和路径，Invoker 仅成功后清空历史。

## 写出和失败边界

SvgShapeMapping 保持独立于模型，负责 data-kind 等持久化标记及私有部件映射。普通节点继续按 ShapeNode 遍历。Writer 对每个模型选择唯一映射，多映射仍报错；这一协议与 AttributeHandler 的首次匹配规则不同，不在本批修改映射优先级。

映射输出的 children 先写，文档节点的 children 按原顺序追加。映射不得重复生成文档成员。完整元素树只映射一次，然后校验 id 唯一性与合法性；重复 id 属性、同时包含 content 和 children 的结果拒绝，避免输出非法 XML 或静默丢弃成员。校验成功才格式化文本，SaveCommand 在拿到完整文本后写文件，成功后更新路径和历史。

本批校验覆盖 SVG 输入及实际输出，Document 的节点索引仍不扫描模型私有成员。后续架构提交 `2b1d518` 已通过 Shape.identifiers() 补齐创建时私有派生 id 冲突及结构恢复预检查，详见[剩余架构记录](../update/20261120_REFACT_EXTENSION_ASSEMBLY.md)。文件系统部分写入失败的回滚仍不属于当前课程内核的事务承诺。

## 验证与范围

公共入口测试扩展定义 Frame、Caption、Panel 及独立映射，验证复合读回、类型缺失降级、非法必要部件拒绝、混合成员、嵌套、递归缓存、输入引用约束、最终映射 id 冲突、私有部件不产生树行，以及读写失败时文档、路径和历史不变。没有正式业务插件或 Handler 编辑路径参与读入。

实现与测试记录见[第五批记录](../update/20261120_REFACT_SVG_PARSE.md)。
