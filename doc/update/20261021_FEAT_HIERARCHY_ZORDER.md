# FEAT：层级结构与 z-order

- 提案时间：2026-10-21
- 完成时间：2026-10-21
- 类型：FEAT
- 关联 prd：doc/prd/phase1/20261016_HIERARCHY_ZORDER.md

<!-- 提案阶段：动因、决策记录、数据模型、架构 / 流程设计，讨论确认后方可进入开发 -->

## 动因

本次实现 HIERARCHY_ZORDER 需求：把 `group`、`ungroup`、`addto`、`front`、`back` 由占位替换为真实实现，五者都是可撤销的编辑命令。

这五个命令改的都是图形的**位置**（在哪个父节点、排第几），不改属性，所以撤销不能用 TRANSFORM_SET 的属性快照。需要确定的是：

- 位置的变更与还原如何表达；
- group 需要"文档顺序"（成员按文档顺序排列、新容器插在第一个成员处），这个顺序从哪里来；
- 包含关系的判断（不能把容器收进自己的子孙）如何实现。

前置：SHAPE_CREATE_DELETE 的图形树（Container、ChildList、`find`、`asContainer`、`parent`）；UNDO_REDO 已完成（继承 EditCommand 即自动入栈）。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 位置变更与撤销的表达 | A：Shape 新增 `relocate(parent, index?)`（从当前父节点摘下，再插到目标位置），并新增位置备忘录类 `Placement` 记录父节点与位置；B：只新增 `relocate`，各命令自行记录"父节点 + 位置"，撤销时 `relocate` 回去 | B | 父节点与位置经 `parent()`、`children().indexOf()` 即可公开取得，不像属性快照那样受封装约束、必须由 Shape 生成，单独建类只是给三元组起名；group / ungroup 记录数组，撤销时按执行的逆序逐个 `relocate` 即可精确还原 |
| 文档顺序从哪里来 | A：Document 提供 `shapes()`，以先序遍历给出全部图形（容器经 `asContainer()` 取子节点）；group 按其中的先后排列成员；B：图形之间两两比较先后 | A | 先序遍历就是 SVG 的绘制顺序，一次遍历即可排序；遍历方式与 tree 相同，不需要判断类型 |
| 包含关系的判断 | A：复用已有的 `find`：`a.find(b.id())` 不为空即 b 在 a 的子树中（含 a 自身）；B：新增祖先链查询（沿 `parent()` 向上） | A | 不新增方法；`find` 本身就是 Composite 的子树查询 |

## 数据模型

| 位置 | 类 | 变更 | 职责 |
| --- | --- | --- | --- |
| backend/receiver/document/shape | `Shape` | 修改 | 新增 `relocate(parent, index?)`：已在某个父节点中时先摘下，再插到 parent 的 index 处（省略时追加到末尾） |
| backend/receiver/document | `Document` | 修改 | 新增 `shapes()`：先序遍历的全部图形；`add(shape, parent, index?)` 支持指定位置 |
| backend/command/impl | `GroupCommand` | 占位 → 实现 | 见下方流程；回显 `g#<newGid> created with <n> children` |
| backend/command/impl | `UngroupCommand` | 占位 → 实现 | 根级容器报 `cannot ungroup top-level container`（以 `shape.parent() === doc` 判断）；子节点按原顺序提升到容器原位置 |
| backend/command/impl | `AddtoCommand` | 占位 → 实现 | 目标为图形自身或其子孙时报错；图形移到目标容器末尾 |
| backend/command/impl | `FrontCommand` / `BackCommand` | 占位 → 实现 | 在兄弟中移到末尾（最上层）/ 开头（最下层） |

示例写法：

```ts
// FrontCommand：记下"父节点 + 位置"，撤销时 relocate 回去
private before: { shape: Shape; parent: Container; index: number } | null = null;

execute(): CommandResult {
  const shape = this.workspace.document().requireShape(this.id);
  const parent = shape.parent();
  this.before = { shape, parent, index: parent.children().indexOf(shape) };
  shape.relocate(parent);                  // 追加到兄弟末尾
  …
}
undo(): CommandResult {
  const { shape, parent, index } = this.before;
  shape.relocate(parent, index);           // 放回原处
  …
}
```

## 架构 / 流程设计

模块划分与依赖规则不变。本次新增 / 修改的文件：

```text
src/backend/
├── command/impl/
│   ├── GroupCommand.ts / UngroupCommand.ts / AddtoCommand.ts   占位 → 实现
│   └── FrontCommand.ts / BackCommand.ts                         占位 → 实现
└── receiver/document/
    ├── Document.ts                 shapes()、add 支持位置
    └── shape/Shape.ts              relocate
```

### group 流程

```text
构造：参数至少 2 个（newGid + 至少一个成员）；成员 id 重复时报错
执行：
  1. 取文档；新容器 id 已存在 → id already exists；new Group(newGid) 校验 id 合法字符
  2. 逐个取成员 → no such shape
  3. 任一成员是另一成员的祖先（a.find(b.id()) 不为空）→ cannot group a container into its own descendant: <a>
  4. 成员按文档顺序（doc.shapes() 中的先后）排列；第一个成员的父节点 P、位置 i
  5. 新容器插到 P 的 i 处，成员依次 relocate 到新容器末尾；每次移动前记下其"父节点 + 位置"
撤销：按执行的逆序把各成员 relocate 回记下的位置，最后摘除新容器
```

### ungroup / addto / front / back

| 命令 | 执行 | 撤销 |
| --- | --- | --- |
| ungroup | 目标须为容器且不是根级；记下容器的"父节点 + 位置"与子节点列表；摘除容器，子节点依次 relocate 到容器原位置起的连续位置 | 子节点依次 relocate 回容器，容器 relocate 回原位置 |
| addto | 目标须为容器，且不是图形自身或其子孙；记下"父节点 + 位置"，`relocate(目标)` | relocate 回原位置 |
| front / back | 记下"父节点 + 位置"，`relocate(父节点)` / `relocate(父节点, 0)` | relocate 回原位置 |

报错文案中 PRD 未给出的部分（addto 的循环、group 的重复 id）开发时自拟。

### 变化点

| 变化点 | 预留 |
| --- | --- |
| 插件复合图形（box）不可 ungroup | 由 box 类声明自己不可解散（如覆盖 `asContainer` 的语义或新增查询），UngroupCommand 据此报 `cannot ungroup composite shape`，随插件阶段落地 |

<!-- 开发阶段：补齐以下内容；上方已确认的决策不得改动 -->

## 测试与验证

`npm test`：38 个测试文件、360 个用例全部通过；`npm run typecheck` 无错误；本次新增与修改的类行覆盖率均为 100%。

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 根下依次为 bg、title、c1、box，`group markers c1 box` 回显 `g#markers created with 2 children`；根下依次为 bg、title、markers，markers 内依次为 c1、box | 单元测试（GroupCommand）+ 子进程（main.test） | 通过 |
| group 的成员来自不同父容器：全部摘出，新容器插在文档顺序第一个成员的父容器中、该成员原来的位置；成员按文档顺序排列，与参数顺序无关 | 单元测试（GroupCommand） | 通过 |
| group 后 `undo`：所有成员回到原父容器原位置，新容器消失（tree 与 group 前逐行相同）；`redo` 回显与结构与首次相同 | 单元测试（GroupCommand）+ 子进程 | 通过 |
| `ungroup` 非根级容器：子图形按原顺序提升到其父级，占据原容器的位置；undo 还原 | 单元测试（UngroupCommand）+ 子进程 | 通过 |
| `addto g1 r1`：r1 成为 g1 的最后一个子节点；目标已是父容器时移到末尾；容器连同子树移动；undo 回到原位置 | 单元测试（AddtoCommand）+ 子进程 | 通过 |
| `front r1` / `back r1`：在同级兄弟中移到最上层（末尾）/ 最下层（开头）；undo 回到原位置 | 单元测试（FrontCommand / BackCommand）+ 子进程 | 通过 |
| `group bad c1 markers`（c1 在 markers 中）报 `error: cannot group a container into its own descendant: markers`，文档不变 | 单元测试（GroupCommand）+ 子进程 | 通过 |
| newGid 已存在报 `id already exists`；newGid 不合法（`1abc`）报 `invalid id` | 单元测试（GroupCommand） | 通过 |
| 任一 id 不存在报 `error: no such shape: r9` | 单元测试（各命令） | 通过 |
| `ungroup` 根级容器报 `error: cannot ungroup top-level container: scene`，文档不变 | 单元测试（UngroupCommand）+ 子进程 | 通过 |
| ungroup / addto 的目标不是容器报 `error: not a container: r1` | 单元测试（UngroupCommand、AddtoCommand）+ 子进程 | 通过 |
| addto 的目标是图形自身或其子孙时报错，文档不变 | 单元测试（AddtoCommand）+ 子进程 | 通过 |
| group 参数中有重复 id 时在构造阶段报错 | 单元测试（GroupCommand）+ 子进程 | 通过 |
| UNDO_REDO 中以 group 为例的 case（`group g1 r1 c1 t1` → `undo` 一次还原全部成员）端到端验证 | 单元测试（GroupCommand）+ 子进程 | 通过 |

实现中补齐的细节（未改动已确认的决策）：

- front、back、addto 三者都是"记下父节点与位置 → relocate 到目标 → 撤销时 relocate 回去"，只是目标不同，收拢为抽象基类 `RelocateCommand`（位于 `backend/command/`，模板方法：子类只给出目标与回显）；
- group 直接构造 Group（命令本身就是新建 g），不经图形工厂；
- main.test 中"占位命令"用例改用仍为占位的 `save`；
- 文案：front / back 回显 `brought to front` / `sent to back`；addto 回显 `<type>#<id> added to g#<gid>`；三者 undo 回显 `<type>#<id> restored into <父节点>`；group 的 undo 回显 `g#<id> removed, <n> children restored`；ungroup 回显 `g#<id> ungrouped, <n> children moved to <父节点>`，undo 回显 `g#<id> restored into <父节点> with <n> children`；addto 的循环报 `cannot add a container into itself or its descendant: <id>`；重复 id 报 `duplicate id: <id>`。

## 遗留问题

- 根级容器不可 ungroup（按参考文档 §4.2）：画布根下 group 出来的容器只能通过 undo 解散，save 之后则无法解散。
- 回显中的 `1 children` 未做单复数处理。
