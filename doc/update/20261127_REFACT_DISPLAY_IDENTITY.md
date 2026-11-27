# REFACT：统一 tree/show 身份，show 递归展示内部组件

- 提案时间：2026-11-27
- 完成时间：2026-11-27
- 类型：REFACT
- 关联 prd：doc/prd/phase1/20261016_DISPLAY.md

## 动因

tree 与 show 对同一个节点给出两个标识：

- `tree` 对 Box 输出 `g#n1 * (box)`；
- `show n1` 首行输出 `box#n1  parent=g#flowchart`；父节点是 Box 时，`parent=box#p`，而 tree 的父行是 `g#p`。

原因不是两个命令各自写错，而是“标识”没有拆分：

- Phase 1 没有复合图形，`type` 同时是注册名、SVG 元素名和展示名，`label() = type#id`（本次改名 `modelLabel()`）一个概念够用；
- Phase 2 的 Box 实际写成 `<g data-kind="box">`，tree 又需要显示 g（`CLI_TREE_LABELS`），于是新增 `treeLabel()` 只改 tree；
- `show` 继续用 `label()`（现 `modelLabel()`），语义未动。

`type` 因此同时承担三个职责：注册键、普通图形的默认元素名、默认展示名。`treeLabel()` 是补丁而不是概念。

show 还有第二个问题：它目前只输出目标节点自己的 `details()`。Box 的真实属性为空，`fill`、`label`、几何都由 `box-attributes` 路由到私有部件，其中 `label` 只是 Handler 的自定义操作名，不是 Box 的真实属性。把 `fill` / `label` 平铺到 Box 的 show 里，等于把“操作名”伪装成“模型属性”。正确做法是递归展示真实存在的内部组件（`rect#n1-rect`、`text#n1-label`）各自的 show 信息。

同类问题也出现在测试复合模型上：`Panel` 的 `type = 'test-panel'`、映射写成 `g`，tree 当前显示 `test-panel#p`，与文件不一致。

目标：

- tree 与 show 共用一个“文件身份”；
- show 递归展示私有组件，不再平铺 Handler 自定义属性；
- 命令回显保留“模型身份”；文档成员仍由 tree 表达。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 标识拆分 | 单一 label / 模型身份 + 文件身份 | 拆分 | tree/show 必须一致；命令消息仍应说 `box` |
| 两个身份的命名 | `label` / `displayLabel` / `modelLabel` / `fileLabel` | `modelLabel` / `fileLabel` | `label` 太泛，`displayLabel` 只说明用途；`modelLabel` / `fileLabel` 直接对应两个身份，且与 `element()` 对称 |
| 文件身份来源 | 模型方法 / writer 映射 / 命令各自拼 | 模型方法 `element()`，默认返回 `type`；复合模型覆写 | tree 不能依赖 svg；映射与显示共用一份事实，避免 `g` 写两遍 |
| `element()` 的默认实现 | 默认返回 `type` / 必须声明 | 默认返回 `type` | 普通图形的文件标签就是类型名，重复声明没有收益；复合模型只需覆写实际标签（如 Box 的 `g`） |
| tree 的标识 | 保留 `treeLabel` / 由 `fileLabel` 统一 | 删除 `treeLabel`，`view().label` 用 `fileLabel` | 少一个补丁；tree 输出不变 |
| show 首行与 `parent=` | 继续 `modelLabel()` / 改 `fileLabel()` | 都改 `fileLabel()` | `parent=` 也是展示字段，不改会残留 `box#p` |
| show 的模型类型提示 | 首行 `(box)` / 明细 `kind=box` / 不提示 | 不提示 | 已确认；show 只展示节点自身，类型由 tree 的 `(box)` 表达 |
| Box 的 show 呈现 | 平铺 `fill` / `label` / 几何 / 递归私有组件 | 递归私有组件 | 已确认；`label` / `fill` 是 Handler 语义，不是 Box 的真实属性 |
| show 的 `children=` | 有组件时仍计数 / 有组件时省略 | 有组件时省略；无组件的容器仍输出 `children=<文档成员数>` | 组件已经逐行展开，再计数会重复；普通 `g` 保持 Phase 1 输出 |
| show 的递归格式 | tree 连线 / 两空格嵌套 | 两空格嵌套，组件首行不带 `parent=` | 与 show 现有缩进一致；层级由缩进表达，避免重复父节点 |
| Box 的文档成员 | show 递归 / 只由 tree 展示 | 只由 tree 展示 | “内部组件”指私有部件；文档成员属于结构，tree 已表达 |
| 命令回显 | 改文件身份 / 保留模型身份 | 保留 `modelLabel()`（如 `box#n1`） | 用户操作的是 Box；避免改全部命令文案与 transcript |
| 测试复合模型 | 保持 `test-panel#p` / 覆写 `element()='g'` | 覆写 `element()='g'`，测试改 `g#p` | 与文件一致，并验证复合模型的覆写路径 |

## 数据模型

- `Shape`
  - 新增 `element(): string`：返回图形写出的底层 SVG 标签；默认实现 `return this.type()`，复合模型覆写为实际标签。
  - 新增 `fileLabel(): string`：`${this.element()}#${this.id()}`。
  - `label()` 改名为 `modelLabel()`，返回 `${type}#${id}`，用于命令回显的模型身份。
  - 删除 `treeLabel()`；`view().label` 改用 `fileLabel()`。
- `ShapeView`
  - 新增 `readonly details: readonly string[]`：显示层可直接使用的明细行（`Shape.details()` 的冻结副本）。
  - 字段与用途不变：tree 仍只读 `label` / `summary` / `attributes` / `content` / `children`；show 新增读取 `details`。
- `Box`
  - 覆写 `element(): string { return 'g'; }`。
  - 删除 `treeLabel()` 覆写。
- `SvgWriter`
  - `elementOf` 的元素名改用 `shape.element()`；普通图形输出不变。
- `box` 插件映射
  - `type` 改用 `shape.element()`，不再手写 `'g'`。
- `ShowCommand`
  - 首行与 `parent=` 改用 `fileLabel()`。
  - 改为递归渲染 `shape.view()`：目标节点输出 header + 非空 `details`；根节点有私有组件时逐块展开组件；根节点没有组件且是容器时输出 `children=<文档成员数>`。
  - 不输出类型提示；不递归文档成员。
  - 组件块只输出 `view.label`、非空 `details` 及其自身组件，不再重复 `parent=`。
- `test/support/SvgCompositeExtension.ts`
  - `Panel` 覆写 `element(): string { return 'g'; }`。

## 架构 / 流程设计

```text
Shape.element() = type()          // 默认实现
Box.element() = 'g'               // 复合模型覆写
Shape.fileLabel() = `${element()}#${id}`
Shape.view() -> { label: fileLabel(), details: freeze(details()), children: viewParts(), ... }

tree:
  Document.shapeViews -> view.label = fileLabel()
  -> TreeRenderer / BaseTreeLineRenderer / TreeDecorator（不变）

show(rootNode):
  view = rootNode.value.view()
  render(view, parentLabel = rootNode.parent()?.value.fileLabel() ?? 'svg', depth = 0)

render(view, parentLabel | null, depth):
  line `${indent}${view.label}` + (parentLabel === null ? '' : `  parent=${parentLabel}`)
  if (depth === 0 && view.children.length === 0 && view.container):
    line `children=${rootNode.children().length}`   // 仅根节点有文档成员
  for detail of view.details（跳过空串）:
    line 缩进 2 的 detail
  for component of view.children:
    render(component, null, depth + 1)

save:
  SvgWriter.elementOf -> element()
  映射（Box / Panel）-> element()
```

show 的目标输出（Box）：

```text
svg> show n1
g#n1  parent=svg
  rect#n1-rect
    x=120 y=100 width=160 height=60
    fill=#4a90d9
  text#n1-label
    x=140 y=135 text="开始"
```

- Box 自身不再出现 `fill=` / `label=`；`label` 是 `box-attributes` 的操作名，真实数据在 `text#n1-label` 的 `text` 属性。
- `children=` 在组件展开时省略；普通 `g` 仍为 `children=<n>`，Phase 1 输出不变。
- 文档成员（嵌套的普通子图形）不进入 show；tree 仍按 `Document.shapeViews` 展示。
- 依赖方向不变：tree / show 只读 `ShapeView`，不依赖 svg；文件元素名由 `element()` 提供，writer 与显示共用。
- `treeLabel` 是 protected 扩展点；仓库外若有插件覆写，需要迁移到 `element()`。仓库内只有 Box。

影响面：

- src：`receiver/document/shape/Shape.ts`、`receiver/document/shape/ShapeView.ts`、`receiver/document/Document.ts`、`receiver/svg/SvgWriter.ts`
- plugins：`core` 的编辑命令与 `ShowCommand` 的标识调用、`box/Box.ts`、`box/index.ts`
- test：`ShowCommand`、`Box`、`BoxSession`、`TreeRenderer`、`PluginHost`、`SvgCompositeRoundTrip`、`Shape`、`Group`、`support/PublicExtension.ts` 及 `support/SvgCompositeExtension.ts`
- doc：更新 `prd/phase1/20261016_DISPLAY.md` 的显示标识与递归规则、AGENTS / README 的显示说明；重录 `doc/transcript/box.out` 的部件行

## 测试与验证

`npm test`：62 个测试文件、558 个用例全部通过；`npm run typecheck` 无错误。

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| `tree` 对普通图形输出不变 | 单元测试（TreeCommand、TreeRenderer） | 通过 |
| `tree` 对 Box 仍为 `g#n1 * (box)` | 单元测试（Box、BoxSession） | 通过 |
| `tree` 对测试 Panel 改为 `g#p` | 单元测试（TreeRenderer、PluginHost） | 通过 |
| `show` 对普通图形的首行、`parent=` 与明细不变 | 单元测试（ShowCommand） | 通过 |
| `show` 对根级 Box：首行 `g#n1  parent=svg`，随后 `rect#n1-rect`、`text#n1-label` 及其明细，无 Box 自身的 `fill=` / `label=` / `children=` | 单元测试（BoxSession） | 通过 |
| Box 的 `rect` 组件显示 `fill=#4a90d9`，`text` 组件显示 `text="开始"` | 单元测试（BoxSession） | 通过 |
| `show` 对普通 `g` 仍为 `g#markers  parent=svg` / `  children=2` | 单元测试（ShowCommand、BoxSession） | 通过 |
| `show` 对 Box 内的文档成员不展开，tree 仍展示该成员 | 单元测试（BoxSession） | 通过 |
| 命令回显仍为 `box#n1 created` / `box#n1 updated` | 单元测试 + transcript 回放 | 通过 |
| 方法改名为 `modelLabel` / `fileLabel` 后所有输出与 transcript 不变 | `npm test` + `npm run verify:transcripts` | 通过 |
| 默认 `element()` 返回 `type`，Box / Panel 覆写为 `g` | 单元测试（Shape、Box、TreeRenderer） | 通过 |
| Box 保存、读回与再次写出不变 | 单元测试（Box、SvgCompositeRoundTrip） | 通过 |
| 文档 transcript 与实际 CLI 输出一致 | `npm run verify:transcripts` | 通过（重录 `box.out` 的部件行，去掉重构前遗留的 `fill`） |
| 新增 `element` / `modelLabel` / `fileLabel` / `ShapeView.details` 通过类型检查 | `npm run typecheck` | 通过 |

## 遗留问题

- Box 的文档成员只由 tree 展示；若以后需要 show 也展示成员，需扩展递归范围并调整 `children=` 规则。
- `element()` 默认返回 `type`，与映射实际写出的元素名没有强制校验；若映射写出与 `element()` 不同，可后续在 writer 增加一致性检查或测试。
- 仓库外插件若仍使用 `Shape.label()` / `displayLabel()` / `elementName()` 会编译失败，需改用 `modelLabel()` / `fileLabel()` / `element()`；本次不保留兼容别名。
- 仓库外若已有插件覆写 `treeLabel()`，删除该 protected 方法会造成编译失败，需要在迁移说明中写明改用 `element()`。
