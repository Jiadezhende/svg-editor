# FEAT：层级结构与 z-order

- 提案时间：2026-10-21
- 完成时间：YYYY-MM-DD（开发完成后填写）
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

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| | | |

## 遗留问题

- 
