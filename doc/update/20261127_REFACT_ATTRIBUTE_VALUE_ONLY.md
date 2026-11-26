# REFACT：变换下放到模型，属性退回纯值语义

- 提案时间：2026-11-27
- 完成时间：2026-11-27
- 类型：REFACT
- 关联 prd：doc/prd/phase2/20261126_SHAPE_REFACTOR.md

## 动因

`Shape.move` / `Shape.scale` 由基类提供共享实现：遍历属性表，对每个 `Attribute` 调用 `translate` / `scale`，由 `CoordinateAttribute` 的轴配置和 `LengthAttribute` 的覆写决定“哪个属性往哪个方向变”。这实际上是把变换语义编码进属性元数据，再用 `Attribute` 的多态驱动同一份实现。

省下的是各模型几行算术，代价是一套两层契约方法、通用的两阶段提交，以及每个属性子类的变换覆写。决定：变换由各模型实现，`Attribute` 只保留值语义（解析、校验、展示、默认值）。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| `move` / `scale` 的实现位置 | 基类共享 / 各模型 | 各模型实现 | 共享实现只是用更复杂的方式实现多态，不值得 |
| 参数守卫的位置 | 基类模板 / 各模型 / 只留命令 | 只在命令层 | 模型覆写 `move` / `scale` 后基类方法体不执行，守卫无法集中；`scale(0)` 得到 0 尺寸是合法结果，正系数属于命令的规则 |
| 基类 `move` / `scale` 的声明 | 抽象 / 空操作 | 抽象 | 空操作无法与“漏实现”区分；容器与纯声明叶子写显式空实现，漏实现编译不过 |
| 模型按值写入 | 保持 `assignValue` 受保护 / 提升为公开 `assign` | 提升为公开 `assign(name, value)` | Box 向 `Text` 部件写计算出的坐标需要按值写入；走 `set(String(n))` 的文本往返不等价（`DecimalFormat` 不接受指数写法） |
| Box 的部件类 | 独立声明 / 继承 `Rect`、`Text` / 直接使用 `Rect`、`Text` | 直接使用 core 的 `Rect` / `Text`，删除 `Frame` 与 `Caption` | 部件没有独有的领域行为，`Frame` 的存在只为一条展示覆写；box 依赖 core 是可接受的组合方式 |

## 数据模型

- `Attribute<T>`：删除 `translate`、`scale`；保留 `name`、`value`、`withToken`、`withValue`、`defaultValue`、`display` 与 `parse` / `validate` / `format` / `recreate`。
- `CoordinateAttribute`：删除 `translate` / `scale` 覆写；保留 `axis()`，锚点校验仍在。
- `LengthAttribute`：删除 `scale` 覆写，只保留非负约束。
- `StrokeWidthAttribute`：只保留非负约束，不再需要变换覆写。
- `Shape`：删除 `transform` 与失败回滚的包裹；`move` / `scale` 改为抽象方法，各模型必须实现；新增 protected 数值读取方法 `number(name)`；`assignValue` 改名为公开的 `assign(name, value)`，接受已解析的值并校验，供模型计算后写入。
- `Box`：直接持有 core 的 `Rect` / `Text`，删除 `Frame` 与 `Caption`；`layoutLabel` 改用 `assign` 写坐标。
- `Document` 不变。

各模型的变换范围：

| 类型 | move | scale |
| --- | --- | --- |
| rect | x y | x y width height |
| circle | cx cy | cx cy r |
| ellipse | cx cy | cx cy rx ry |
| line | x1 y1 x2 y2 | x1 y1 x2 y2 |
| text | x y | x y |
| g | 显式空实现 | 显式空实现 |
| box | Rect、Text（委派） | 同左 |
| box 的部件 | 用 rect / text 的实现 | 用 rect / text 的实现 |

## 架构 / 流程设计

```text
Document.move(root, dx, dy)
  for node of nodes(root): node.value.move(dx, dy)
Rect.move → 写 x、y
```

变化点：

- 属性层不再认识变换；`Attribute` 只回答“这个值合不合法、怎么展示”。
- 新增图形类型必须实现 `move` / `scale`，否则编译不过。
- 模型不再校验操作参数、不再回滚；非法系数或运算溢出在写属性时才被属性规则拒绝，可能留下半改状态。

影响面：

- src：`attribute/Attribute.ts`、`attribute/CoordinateAttribute.ts`、`attribute/LengthAttribute.ts`、`attribute/StrokeWidthAttribute.ts`、`Shape.ts`
- plugins：`core/{Rect,Circle,Ellipse,Line,Text}.ts`、`box/Box.ts`（改为直接使用 core 的 `Rect` / `Text`，删除 `Frame`、`Caption`，`layoutLabel` 改用 `assign`）
- test：调整 `attribute/{Attribute,CoordinateAttribute,LengthAttribute,StrokeWidthAttribute,StringAttribute}.test.ts`、`Shape`、`ShapeInvariant`、`Leaves`、`CompositeShape`；`test/support/*` 与测试内联的 Shape 桩全部补 `move` / `scale`（`Group` 写空实现）；为各内置类型补充变换范围用例
- doc：更新关联 prd 中“坐标按轴平移”与 `translate` / `scale` 契约条目

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 各内置类型的 move / scale 范围与回显 | 单元测试 | 通过（`Leaves.test` 逐类断言移动与缩放后的属性） |
| 容器的递归变换与撤销 | 单元测试 | 通过（`ShapeInvariant`、`CompositeShape`、Move/Scale 命令用例） |
| 参数守卫：`scale(0)` 缩到 0 尺寸、`move(NaN)` 在写属性时被拒绝 | 单元测试 | 通过（`ShapeInvariant` 改写为属性规则拒绝） |
| 未实现 `move` / `scale` 的子类无法通过类型检查 | 类型测试 | 通过（`npm run typecheck`） |
| Box 改为直接用 Rect/Text 后，读回与属性读写不变；tree 部件行不再内联 `fill` | 单元测试 | 通过（`Box`、`BoxSession` 用例同步） |
| 属性类只剩值语义：解析、校验、展示、默认值 | 单元测试 | 通过（`attribute/*` 用例删除变换断言） |

## 遗留问题

- Box 与 core 之间新增编译期依赖：加载 `box` 需要 `core` 的模块存在，这是已确认接受的组合方式。
- 私有部件的展示：`Frame` 删除后 tree 的框体行不再内联 `fill`，`show <box>` 也只显示 `children=n`，框体填充暂时不可见。展示设计不在本次范围，后续在 Box 的视图或装饰器里补。
- 所有具体模型（含 `Group` 与测试桩）都要写显式实现，“叶子只做声明”的约定到此结束；抽象方法把这份代码量固定下来，漏实现会在编译期暴露。
- 直接调用 `scale(0)` 会把图形缩到 0 尺寸：0 是合法长度，模型不拦；需要拦住时由命令的前置校验负责。模型也不再回滚，直接调用失败可能留半改状态。
