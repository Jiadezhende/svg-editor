# REFACT：删除坐标轴与锚点注册校验，合并 CoordinateAttribute

- 提案时间：2026-11-27
- 完成时间：
- 类型：REFACT
- 关联 prd：doc/prd/phase2/20261126_SHAPE_REFACTOR.md

## 动因

变换下放到模型之后，`axis` 不再参与任何运行时行为：`translate` 已随属性变换一起删除。公开的 `axis()` 只剩 `ShapeFactory.checkAnchor` 一个消费者，用于在注册期校验 `anchor` 的第一个名字是 x 轴坐标、第二个是 y 轴坐标。

同时，删除 `translate` / `scale` 后 `CoordinateAttribute` 只剩 `axis()`，与 `NumericAttribute` 的唯一差别是“不要求非负”——而这正是数值属性的默认行为。它已经退化为一个只用来标记身份的类。

锚点写错的影响范围只有 `move` 回显的坐标顺序，平移本身不受影响。为这一处回显在属性契约里保留轴概念，成本高于收益。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| `axis` 与 `axis()` | 保留 / 删除 | 删除，含 `Axis` 类型 | 没有运行时消费者 |
| 锚点注册校验 | 保留 / 删除 | 删除 `ShapeFactory.checkAnchor` | 只影响回显文本，可由用例覆盖 |
| `CoordinateAttribute` | 保留为标记类 / 合并 | 删除，坐标改用 `NumericAttribute` | 无独有行为 |
| `NumericAttribute` | 保持抽象 / 具体化 | 具体化，补 `recreate` | 模板需要能直接声明坐标 |
| `anchor` 声明 | 保留 / 删除 | 保留 | `position()` 与 `move` 回显仍需要 x、y 属性名 |

## 数据模型

- `Attribute<T>`：删除 `axis()` 与 `Axis` 类型。
- `NumericAttribute`：由抽象类改为具体类，补 `recreate`；仍负责有限数字与默认值 0。
- `CoordinateAttribute`：删除文件与公共导出。
- `ShapeFactory`：删除 `checkAnchor`；`ShapeModel` 与 `definition()` 中的 `anchor` 保留。
- `anchor`：语义收窄为“`move` 回显使用的 x、y 属性名”，不再参与注册校验。

## 架构 / 流程设计

```text
Rect.params = [NumericAttribute('x'), NumericAttribute('y'), LengthAttribute('width'), LengthAttribute('height')]
Rect.anchor = ['x', 'y']            # 仅用于 position()
ShapeFactory.register(Rect)         # 不再校验 anchor
move → MoveCommand.describe → shape.position() → display(anchor[0]), display(anchor[1])
```

变化点：

- 图形模板不再表达“这个属性属于哪个轴”，只表达“这是一个数值”。
- 注册契约变薄；锚点写错的唯一发现途径是 `move` 回显或测试。
- 公共入口删除 `CoordinateAttribute`，`NumericAttribute` 成为可直接实例化的类；现有插件模板全部改写。

影响面：

- src：`attribute/Attribute.ts`、`attribute/NumericAttribute.ts`、删除 `attribute/CoordinateAttribute.ts`、`ShapeFactory.ts`、`index.ts`
- plugins：`core/{Rect,Circle,Ellipse,Line,Text}.ts`；Box 已直接使用这些类型，无需单独改写
- test：删除 `CoordinateAttribute.test.ts`，新增 `NumericAttribute.test.ts`；调整 `Attribute`、`Leaves`、`ShapeFactory`、`Shape`、`ShapeParse`、`Receiver`、`DependencyInjection`、`Box`、`PublicApi` 及 `test/support/*`
- doc：更新关联 prd 中 `axis()` 契约条目与“锚点引用错误坐标轴”验收场景

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 坐标可为负，长度与线宽不可为负 | 单元测试 | 待定 |
| 注册任意 `anchor` 不再报错（反转原校验用例） | 单元测试 | 待定 |
| `move` 回显仍按 `anchor` 顺序输出坐标 | 单元测试 | 待定 |
| `NumericAttribute` 可实例化并保留解析、校验、展示规则 | 单元测试 | 待定 |

## 遗留问题

- 锚点写错不再有注册期报错，属于用可读性换掉的一条校验；若后续需要，应以图形声明侧的显式类型约束实现，而不是回到属性携带轴。
