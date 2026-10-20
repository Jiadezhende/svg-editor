# FEAT：平移、缩放与属性设置

- 提案时间：2026-10-20
- 完成时间：YYYY-MM-DD（开发完成后填写）
- 类型：FEAT
- 关联 prd：doc/prd/phase1/20261016_TRANSFORM_SET.md

<!-- 提案阶段：动因、决策记录、数据模型、架构 / 流程设计，讨论确认后方可进入开发 -->

## 动因

本次实现 TRANSFORM_SET 需求：把 `move`、`scale`、`set` 由占位替换为真实实现，三者都是可撤销的编辑命令。

需要确定的是：

- 平移、缩放如何对容器与叶子统一操作（Composite），且不在命令中按类型分支；
- 撤销如何做到"文档状态与执行前完全一致"：浮点数的反向运算（如先乘 3 再乘 1/3）不一定能精确还原；
- 叶子的 move 回显坐标（rect 的 `(x,y)`、circle 的 `(cx,cy)`、line 的 `(x1,y1)`）从哪里来，且有保障。

前置：

- SHAPE_CREATE_DELETE 的属性种类已预留 `translate` / `scale`，CoordinateSpec 已带轴；
- UNDO_REDO 已完成：继承 EditCommand 即自动入栈，redo 即再次 `execute()`。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 平移 / 缩放的实现位置 | A：属性种类负责单个值的变换（`translate` / `scale`，默认不变），Shape 的 `move` / `scale` 对属性表通用处理，Group 覆盖为"自身 + 递归子节点"（Composite）；B：命令遍历子树，对每个图形逐个处理 | A | 容器与叶子由同一个方法统一操作，命令不需要知道对象是不是容器；坐标、尺寸、线宽、颜色的差异由属性种类的多态承担 |
| 撤销方式 | A：备忘录：执行前由图形生成属性快照（容器连同整棵子树），undo 时写回；B：反向操作：move 反向平移，scale 乘以 1/factor，set 写回旧值 | A | B 的浮点反向运算不能保证精确还原，违背"undo 后状态与执行前完全一致"；A 对 move / scale / set 写法统一，快照由图形自己生成并恢复，内部值不对外暴露 |
| 叶子 move 回显坐标的来源 | A：通用规则：取 `params` 中第一个 x 轴坐标与第一个 y 轴坐标；B：各图形类以静态 `anchor` 显式声明锚点所用的两个坐标属性（默认 null，g 沿用 null 即回显 `moved by (dx,dy)`），ShapeFactory 注册时校验：两个名字须为本类的坐标属性，且依次为 x 轴、y 轴，否则启动即失败；C：统一回显偏移 `moved by (dx,dy)`，不需要锚点 | B | A 依赖声明顺序这一隐含约定，没有保障，写错时不会报错；B 锚点一眼可见，写错在启动时发现；C 与课程 transcript 的回显格式不一致。锚点名称各不相同，是因为沿用 SVG 属性名，各类型的"位置"本身含义不同（rect 为左上角、circle 为圆心、line 为起点） |

## 数据模型

| 位置 | 类 | 变更 | 职责 |
| --- | --- | --- | --- |
| backend/receiver/document/attribute | `AttributeSpec` | 修改 | 新增 `translate(value, dx, dy)`、`scale(value, factor)`，默认原样返回；`axis()` 上移到基类，默认 null（不是坐标），供锚点校验使用 |
| 同上 | `CoordinateSpec` | 修改 | `translate` 按轴加上 dx 或 dy；`scale` 乘以 factor |
| 同上 | `LengthSpec` | 修改 | `scale` 乘以 factor；平移不变 |
| 同上 | `StrokeWidthSpec` / `StringSpec` / `TextSpec` | 不变 | 沿用默认：平移、缩放都不变 |
| backend/receiver/document/shape | `Shape` | 修改 | 新增 `move(dx, dy)`、`scale(factor)`：对已设置的属性逐个交给属性种类变换；`set(name, token)`：按属性表查属性（没有则报 `unknown attribute`），解析、校验后写入；静态 `anchor`（默认 null）；`position()`：按 `anchor` 取锚点坐标，没有锚点时为 null；`capture(): ShapeMemento`：生成属性快照 |
| 同上 | `Group` | 修改 | 覆盖 `move` / `scale`：自身 + 递归子节点；覆盖 `capture`：自身快照 + 各子节点快照 |
| 同上 | `Rect` / `Circle` / `Ellipse` / `Line` / `Text` | 修改 | 声明 `anchor`：`['x','y']` / `['cx','cy']` / `['cx','cy']` / `['x1','y1']` / `['x','y']` |
| 同上 | `ShapeFactory` | 修改 | 注册时校验 `anchor` |
| 同上 | `ShapeMemento` | 新增 | 备忘录：保存一个或多个图形的属性快照，`restore()` 写回；只能由 Shape 生成，内部值不对外暴露 |
| backend/command/impl | `MoveCommand` | 占位 → 实现 | 构造时解析 dx、dy；执行时取快照后平移，叶子回显 `moved to (x,y)`，容器回显 `moved by (dx,dy)`；undo 恢复快照，回显 `moved back to (x,y)` / `moved back by (-dx,-dy)` |
| backend/command/impl | `ScaleCommand` | 占位 → 实现 | 构造时解析 factor，非正数报 `scale factor must be positive`；执行时取快照后缩放；undo 恢复快照 |
| backend/command/impl | `SetCommand` | 占位 → 实现 | 构造时记下属性名与原始取值文本；执行时取快照后 `shape.set(name, token)`，回显 `updated: <attr>=<值>`（展示格式，text 加引号）；undo 恢复快照，回显旧值；旧值原本未设置时，恢复后该属性仍为未设置 |

示例写法：

```ts
// Shape：对属性表通用处理
move(dx: number, dy: number): void {
  for (const spec of this.definition().attributes()) {
    const value = this.values.get(spec.name());
    if (value !== undefined) this.values.set(spec.name(), spec.translate(value, dx, dy));
  }
}

// Group：自身 + 递归子节点（Composite）
override move(dx: number, dy: number): void {
  super.move(dx, dy);
  for (const child of this.children()) child.move(dx, dy);
}

// 命令：不关心对象是叶子还是容器
execute(): CommandResult {
  const shape = this.workspace.document().requireShape(this.id);
  this.memento = shape.capture();
  shape.move(this.dx, this.dy);
  …
}
undo(): CommandResult {
  this.memento.restore();
  …
}
```

## 架构 / 流程设计

模块划分与依赖规则不变。本次新增 / 修改的文件：

```text
src/backend/
├── command/impl/
│   ├── MoveCommand.ts              占位 → 实现
│   ├── ScaleCommand.ts             占位 → 实现
│   └── SetCommand.ts               占位 → 实现
└── receiver/document/
    ├── attribute/
    │   ├── AttributeSpec.ts        新增 translate / scale，axis 上移
    │   ├── CoordinateSpec.ts       平移按轴、缩放同乘
    │   └── LengthSpec.ts           缩放同乘
    └── shape/
        ├── Shape.ts                move / scale / set / position / capture
        ├── Group.ts                递归子节点
        ├── Rect.ts … Text.ts       声明 anchor
        ├── ShapeFactory.ts         注册时校验 anchor
        └── ShapeMemento.ts         新增
```

### 校验顺序

- move / scale：构造时校验参数个数与数字（scale 的 factor 须为正数，是命令参数自身的规则，也在构造时校验）；执行时无文档 → 图形不存在。
- set：属性能否设置、取值如何解析都取决于图形类型，只能在找到图形后判断。构造时只校验参数个数；执行时依次为无文档 → 图形不存在 → `unknown attribute` → 取值格式（如不是数字）→ 取值约束（如不得为负）。

### 变化点

| 变化点 | 预留 |
| --- | --- |
| 插件类型（box） | 声明 `params` 即获得 move / scale / set，声明 `anchor` 即获得回显坐标；PRD 中 box 的"set 传播语义"可由其类覆盖 `set` 实现 |
| 层级调整（group / ungroup / addto） | 不改属性，撤销沿用 SHAPE_CREATE_DELETE 的"记录父节点与位置"，不使用本次的属性快照 |

<!-- 开发阶段：补齐以下内容；上方已确认的决策不得改动 -->

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| | | |

## 遗留问题

- 
