# REFACT：SVG 读写改为 parse + toSvg 多态

- 提案时间：2026-11-27
- 完成时间：2026-11-27
- 类型：REFACT
- 关联 prd：doc/prd/phase2/20261125_CLI_EXTENSION_CONTRACTS.md

## 动因

读入的类型特有行为已经由 `Shape.parse` 多态承担：Box 认领 rect/text，Rect 解析几何，SvgReader 只负责 XML 递归和类型选择。写出却依赖独立的 `SvgShapeMapping`：

- `shapes` 贡献同时提交 `{ model, mapping }`，Writer 再按 `matches` 逐节点扫描；这是图形工厂之外的又一处类型分派。
- `mapping.write` 只拿到 Shape，却要重新拼装自身属性、`data-kind` 和私有部件；Box 从 `shape.view()` 取数据，Panel 用 `elementOf`，两条路径不一致。
- 递归职责不对等：读入由模型调用 `readChildren` 决定消费哪些部件；写出却由 Writer 拿 `parts()`/mapping 结果递归，模型内部组成被外部遍历。
- 私有部件的消费是隐式的：`parse` 不返回的子 Shape 被当作 parts，Reader 无法区分“已消费”和“漏掉”。

目标：让读写的类型特有行为都落在 Shape 上，Writer/Reader 只保留外部树、文本和校验；删除 `SvgShapeMapping` 注册表。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 写出入口 | 外部 mapping / 模型多态 `toSvg` | `Shape.toSvg()` | 递归跟随数据所有权：XML 树属于 Reader，文档节点树属于 Writer，私有部件树属于 Shape |
| 私有部件声明 | Writer 遍历 `parts()` / 模型内部 `parts()` | 受保护 `parts()`，由基类 `toSvg()` 调用 | 保持模型内部递归，Writer 不接触私有部件；复合模型不必重复 `super.toSvg()` |
| 读入结果 | 只返回 children / 显式 parts | `ShapeParseResult` 增加 `parts` | 读入与写出的组成声明对称；Reader 能校验归属，不再静默丢弃 |
| 映射注册 | 保留 `SvgShapeMapping` / 删除 | 删除 `SvgShapeMapping`、`SvgWriter.register`、`elementOf` | 消除第三处按类型分派；插件只注册 Shape 类 |
| `data-kind` | 映射手写 / 基类自动 | `element() !== type()` 时基类自动写 | 复合模型漏写会读回降级；放在唯一元素构造处可保证往返 |
| 私有 id 契约 | 精确集合 / 声明 id 必须出现 | `identifiers()` 默认由 `parts()` 汇总；Writer 要求声明 id 都出现，允许额外结构 id | 捕获漏写部件；同时允许 `title-group` 这类结构包装 id，最终由全局唯一性检查兜底 |
| DTO 位置 | `svg/` / `document/shape/` | `SvgElement` 移至 `document/shape/SvgElement.ts` | 保持 `svg → document` 依赖方向；Shape 只返回纯数据，不依赖 svg 模块 |
| 展示视图 | 默认由 `parts()` 生成 / 保持可选 | `viewParts()` 仍默认空，Box 显式覆写 | 私有部件参与保存不等于必须出现在 tree/show；Panel 等测试模型保持原输出 |

## 数据模型

- `SvgElement`（新文件 `src/backend/receiver/document/shape/SvgElement.ts`）
  - 字段不变：`type`、`attributes`、`content?`、`children?`。
  - 从 `SvgWriter.ts` 迁出；`backend/index.ts` 继续导出该类型。
- `Shape`
  - 新增 `toSvg(): SvgElement`：`type = element()`，属性为 `id`、必要时 `data-kind`、`entries()`，`content = content()`，`children = parts().map(part => part.toSvg())`。
  - 新增 `protected parts(): readonly Shape[]`，默认空；Box、Panel、测试复合模型覆写。
  - `identifiers()` 默认改为 `[id, ...parts().flatMap(part => part.identifiers())]`；需要额外私有 id 的模型可覆写。
  - `viewParts()` 默认仍为空；Box 显式提供私有部件视图。
- `ShapeParseResult`
  - 增加 `readonly parts: readonly Shape[]`。
  - 默认 `parse` 返回 `parts: []`；容器仍把 `readChildren()` 全部作为 `children`。
- `PluginContributions`
  - `shapes` 从 `{ model, mapping? }[]` 改为 `readonly ShapeModel[]`。
- `SvgWriter`
  - 删除 `SvgShapeMapping`、`mappings`、`register`、构造参数、`elementOf`。
  - `mapNode` 调用 `node.value.toSvg()`，追加文档成员。
  - 新增 `checkOwn`：元素名、`data-kind`、声明 id 覆盖。

## 架构 / 流程设计

```text
写：
Document → ShapeNode 树
  → shape.toSvg()（基类调用 parts()，模型内部递归）
  → Writer 追加文档成员
  → checkOwn（元素名 / data-kind / 声明 id 覆盖）
  → checkElement（全局 id、content/children 歧义）
  → 文本格式化 → 文件写入

读：
XML → SvgReader 递归
  → ShapeFactory.parse（按 data-kind / 标签选类）
  → shape + parts + children
  → 校验 type / element、parts/children 归属、私有 id
  → 构建候选 Document → 成功后替换当前文档

装配：
activate() → shapes: ShapeModel[]
  → factory.register(model)
  → Writer 无类型映射表
```

职责边界：

- Reader：XML 语法、类型选择、递归缓存、输入 id 检查、候选文档组装。
- 模型：`parse` 构造并声明消费的 parts；`toSvg` 生成自身及私有部件；`identifiers` 声明 id。
- Writer：追加文档成员、元素树校验、转义、缩进、数值格式、写文件前保护。
- 依赖方向不变：`svg → document`；`SvgElement` 位于 document，Shape 不依赖 svg 模块。

错误与失败：

- 写出前 `checkOwn` 拒绝元素名不符、`data-kind` 缺失/不符、`identifiers()` 中声明的 id 未写出。
- `checkElement` 保持重复/非法 id、重复 id 属性、content 与 children 并存的拒绝。
- 读入新增：`parsed.shape.type()` 与选择类型不符、`element()` 与标签不符、未声明 part、part 带文档子节点、未归属叶子、文档成员占用私有 id。
- 保存失败不写文件、不更新路径；读入失败不替换当前文档。

## 测试与验证

`npm run typecheck` 无错误；`npm test`：62 个测试文件、564 个用例全部通过；`npm run verify:transcripts` 通过。

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| Box 保存、读回、再次写出逐字不变，私有部件不成为文档节点 | Box / BoxSession / SvgCompositeRoundTrip 单元测试 | 通过 |
| Panel 保存保持 `g data-kind="test-panel"`，部件在前、文档成员在后 | SvgWriter / SvgCompositeRoundTrip / PluginHost | 通过 |
| 复合模型自身及私有部件在前，文档成员按原顺序追加 | SvgWriter 单元测试 | 通过 |
| `toSvg` 每个节点只执行一次 | SvgCompositeRoundTrip spy | 通过 |
| 元素名不符、`data-kind` 缺失、声明 id 未写出时写文件前失败 | SvgWriter 单元测试 | 通过 |
| 读入拒绝未声明 part、part 带文档子节点、未归属叶子、文档成员占用私有 id | SvgCompositeReader 单元测试 | 通过 |
| 读入拒绝 `data-kind` 选中类型的 element 与标签不符、parse 返回类型不符 | SvgCompositeReader 单元测试 | 通过 |
| 装配只注册 Shape 类，Four 类扩展与模型写出仍参与命令、属性、树和读写 | PluginHost / UnifiedPlugins | 通过 |
| 插件注册失败时整包丢弃，之后同名扩展可正常装配 | PluginHost | 通过 |
| 保存复用注入 writer，失败保留文档、路径与历史 | DependencyInjection / SaveReadCommand | 通过 |
| 普通图形、Box、Panel 的 transcript 不变 | `npm run verify:transcripts` | 通过 |

## 遗留问题

- 私有部件当前只支持“根 + 直接叶子子元素”：`readChildren` 只返回直接子 Shape，Reader 拒绝 part 带文档子节点。`toSvg` 可以写出嵌套包装，但复合类型读回时不能还原为私有部件；嵌套包装的 id 会作为额外元素参与全局校验，读回可能成为普通文档节点。
- Writer 只要求 `identifiers()` 声明的 id 都出现，允许额外结构 id（如测试中的 `title-group`）；额外 id 在保存时做全局唯一性检查，但 Document 的节点索引看不到它们。
- `identifiers()` 默认由 `parts()` 派生，覆写者需保证它列出所有持久化私有 id；仅用于展示、不参与保存的伪部件不应放进 `parts()`，否则需要覆写 `toSvg` 或 `identifiers`。
- 历史 ADR 与旧 update 文档保留原 `SvgShapeMapping` 描述，作为当时决策记录；本文件与 AGENTS / README 代表当前实现。
