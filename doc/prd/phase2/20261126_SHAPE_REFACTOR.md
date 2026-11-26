# Shape 重构

- 记录于 2026-11-26，所属阶段为 Phase 2
- 状态为已确认：属性对象、按 id 构造和 Receiver 收尾校验已定，待进入开发

## 需求背景

`Shape` 是单个图形的领域模型，负责自身属性、行为和内部部件。当前实现将属性规则和实例的值分别存放，通过属性名关联。重构将同一属性的值和行为封装在 `Attribute` 中，使模型能按名称直接访问属性，并通过属性对象完成解析、校验与展示。 [Shape 实现](../../../src/backend/receiver/document/shape/Shape.ts)

## 决策记录

| 议题 | 决定 | 状态 |
| --- | --- | --- |
| Shape 属性状态 | 实例通过私有 `Map<string, Attribute>` 按名称保存属性对象 | 已明确 |
| 可选属性未赋值 | 构造时为全部已声明的实例属性建立条目。可选属性未赋值时，其 `Attribute.value` 为 `null` | 已明确 |
| 属性规则 | 具体 `Attribute` 子类实现 `validate` 等规则。移除 `AttributeSpec` 和 `AttributeValue`，边界直接使用 `number`、`string` 及所需的 `null` | 已明确 |
| 类级声明 | 图形类以有序、不可变的 `Attribute` 模板声明属性。模板属于类本身，实例构造时据此建立 Map | 已明确 |
| 属性名称 | 类级模板显式写出 `[属性名, Attribute 模板]`。`Attribute` 的字段只包含当前值和具体子类所需的配置 | 已明确 |
| 属性更新 | 实例属性对象不可变，校验成功后替换。快照可浅拷贝 Map，变换可在全部成功后一次提交 | 已明确 |
| 构造 | 构造时传入 id：构造内校验并绑定根标识，按模板建立条目（初始 `null`），复合图形据此派生部件标识并准备部件。同一构造可选接受初始值，供恢复和复合模型初始化 | 已明确 |
| 基础外观归属 | `Shape` 合并 `fill`、`stroke`、`stroke-width`；复合模型可覆写属性表，不合并基础外观。`Box` 的外观全部由 `Frame` 承载 | 已明确 |
| 整图校验 | `Shape.validate()` 检查必填属性、跨属性约束与部件结构。由 `Receiver.createShape`、`Receiver.set` 和 `Shape.parse` 触发，命令不直接调用 | 已明确 |

## 属性对象方案

`Attribute<T extends number | string>` 持有当前值 `T | null`。例如矩形未设置 `fill` 时，`attributes.get('fill')` 返回值为 `null` 的属性对象。Map 中缺少某个键表示该名称未声明。具体属性子类直接实现或继承各自的 `validate`、解析、默认值、展示及变换规则。

图形类的类级模板显式写出有序的 `[属性名, Attribute 模板]`。以圆为例，`new NumericAttribute('cx')` 中的 `cx` 既是 Map 的键，也是 SVG 属性名。`Shape` 按这些键和顺序建立实例 Map，替换属性值时使用原键。合并基础外观和图形自身属性时，在建立 Map 前检查显式键重名；覆写属性表而不合并外观的复合模型不参与该检查。 [现有 Shape 实现](../../../src/backend/receiver/document/shape/Shape.ts)

`Shape` 负责检查属性集合、必填约束及整体更新。`Attribute` 负责单项值是否合法。数字属性继续使用统一的 `DecimalFormat`。变换由各模型在 `move` / `scale` 中直接按值计算：坐标与尺寸乘系数，`stroke-width` 与文字内容不参与缩放，未赋值的可选属性不受影响。 [十进制规则](../../../src/backend/utils/DecimalFormat.ts)

### Attribute 字段和方法（契约）

- `readonly value: T | null` 是当前值。

| 方法 | 职责 |
| --- | --- |
| `withToken(token)` | 解析输入文本，校验后返回新属性。供 `Shape.set` 使用。 |
| `withValue(value)` | 校验已有的数字或字符串，返回新属性。供模型从原值构造或恢复时使用。 |
| `defaultValue()` | 返回该类属性的默认值，供模型恢复数据时按需使用。 |
| `display()` | 返回当前值的展示文本。值为 `null` 时返回 `null`。 |

`parse(token)` 和 `validate(value)` 是子类实现的受保护方法。返回新属性的操作保留具体子类及其构造配置。`Shape` 使用原 Map 键写回新对象，也可用该键提供校验错误的属性名。必填约束由 `Shape.validate()` 检查。

## 模型初始化与复合结构

- 构造时传入 id，并在构造内校验、绑定根标识。构造按类级模板建立全部属性条目，初始值为 `null`；可选初始值只用于恢复与复合模型初始化，用户编辑一律经 `set`（复合模型由 Handler 路由到部件的 `set`）。
- 构造期间必填属性可暂为 `null`，构造完成不等于模型完成。完整性由 `Shape.validate()` 检查必填属性、跨属性约束与部件结构。
- `Box` 持有 `Frame` 和 `Caption`，提供部件访问入口、标题重排与快照。新建时沿用框体默认填充 `#4a90d9`，并根据框体几何计算文字位置；恢复时使用已有部件的属性。`Box.capture()` 覆盖自身和所有可修改部件。 [现有 Box 模型](../../../plugins/box/Box.ts) [Box 读回 ADR](../../adr/phase2-02-box-readback.md)
- `Box` 覆写属性表为空：外观、标题与几何都由内部部件承载，经 `box-attributes` 读写，自身不再声明基础外观。

## 接口契约（已确认）

| 入口 | 预期行为 |
| --- | --- |
| `constructor(id, values?)` | 绑定并校验根标识，按类级模板建立属性条目；`values` 只用于恢复或复合模型初始化，创建路径不传。 |
| `Shape.validate()` | 整图校验入口，检查属性完整性和模型结构；由 Receiver 的创建与设置入口以及 `Shape.parse` 调用。 |
| `Shape.parse(id, attributes, readChildren)` | 复用同一构造和整图校验。缺失的必填属性使用属性默认值，省略的可选属性为 `null`，忽略未声明属性。明确给出的非法值导致恢复失败。 |
| `set(name, token)`、`value(name)`、`display(name)` | 按名称取得属性，写入前先解析和校验。公开读取在未知属性或未赋值时返回 `null`，设置未知属性仍报错。 |
| `assign(name, value)` | 写入已解析的值并按属性规则校验，供模型计算与恢复使用；与 `set(name, token)` 并列。 |
| `entries()`、`content()`、`view()` | 按声明顺序提供有值的属性，单独返回文本内容。只读视图使用原始数字和字符串，省略未赋值属性，保留明确给出的 `0`、空字符串和 `"none"`。 |
| `move()`、`scale()`、`capture()` | 变换由各模型实现，按属性值计算，模型必须实现这两个方法。快照恢复各属性的值，含可选属性的 `null` 状态。 |

## 实施约束

- 文本输入先解析再 `validate`，原值恢复和变换结果也经过同一子类校验。异构 Map 的原值入口可接收 `number | string`，由具体子类校验值的运行时类型及约束。基类构造期间避免调用依赖子类字段的覆写方法。 [现有不变量测试](../../../test/backend/receiver/document/shape/ShapeInvariant.test.ts)
- 属性变换全部校验后才提交。复合图形变换失败时用自身快照恢复各部件。不可变的 `Attribute` 允许快照浅拷贝 Map 并保留每个旧属性对象。
- 构造不再检查必填。所有生成完成模型的路径都以 `validate()` 收尾，`Receiver.createShape` 与 `Shape.parse` 是仅有的两个成图出口。 [公开入口](../../../src/backend/index.ts) [图形扩展示例](../../../test/support/PublicExtension.ts)
- 覆写属性表的复合模型，`attributes()`、`entries()` 和 `view()` 必须按覆写结果一致工作，不得只改其一。
- 公开入口迁移到新的 `Attribute` 子类。已有图形声明、直接构造及自定义 `parse` 也使用新契约，`ShapeView` 继续以原始值提供只读数据。

## 验收场景（已定稿）

| 场景 | 输入或前置状态 | 预期行为 |
| --- | --- | --- |
| 普通属性 | 在矩形调用 `set`、`move` 或 `scale` | 变更采用各属性原有的解析、校验规则；`stroke-width` 与文字内容在变换中保持原值。 |
| 属性未设置 | 初始化时省略可选 `fill`，设置后恢复模型快照 | 初始化与恢复后的 Map 均包含 `fill`，其值为 `null`，`entries()` 省略 `fill`。 |
| 实例隔离 | 初始化两个矩形并修改其中一个的 `fill` | 另一个矩形和类级模板的值均保持原状。 |
| 未声明属性 | 尝试设置矩形的 `unknown` | Map 中无该键，沿用未知属性错误。 |
| 声明冲突 | 自定义属性与基础外观重名 | 模型声明校验报告错误，重复属性在建立 Map 前发现。 |
| 模型变换失败 | 数值溢出或一个复合部件变换失败 | 属性规则拒绝该次写入；模型不自行回滚，恢复由编辑命令负责。 |
| 构造与校验分离 | 只构造、未写入必填属性 | 构造成功，`validate()` 报告未满足的模型约束。 |
| 整图校验失败 | 初始化结束后仍缺少必填项或必要部件 | Receiver 的创建入口在写入完成后报告，候选不入树。 |
| 模型恢复 | `Shape.parse` 取得缺少必填属性、空文本或显式零值的数据 | 按默认规则补齐缺失值，保留空文本及显式零值。 |
| 模型输出 | 获取基础图形或 `Box` 的属性、文本和视图 | 按声明顺序输出属性，保留文本及部件的视图内容。 |

## 待确认

- 复合模型部件访问入口的具体形式：直接返回部件对象，还是返回只提供 `set`、`display`、`value` 的收窄接口。
