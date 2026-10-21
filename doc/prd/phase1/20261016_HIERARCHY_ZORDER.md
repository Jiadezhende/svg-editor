# 层级结构与 z-order

- 时间：2026-10-16
- 所属阶段：phase1

## 需求背景

图形的归属有三种时机：创建时归属（`create … in`）、事后收编（`group`）、移动归属（`addto`）。本需求覆盖后两种，以及解散容器（`ungroup`）和同级叠放次序调整（`front` / `back`）。参考：refs/phase_1.md §3（group、ungroup、addto、front、back）、§4.1、§4.2、§6。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 根级容器（svg 的直接子节点）能否 ungroup | A：拒绝（`cannot ungroup top-level container`）；B：放宽，子图形提升到画布根 | A | 参考文档 §4.2 明文规定，验收以其为准；代价是画布根下 group 出来的容器只能通过 undo 解散。参考文档命令总表"子图形提升到原容器的父级"与之矛盾，且无会话样例佐证，按更具体的错误约定处理 |
| group 新容器的位置与成员顺序 | A：新容器插在文档顺序中第一个成员的父容器内、该成员原来的位置，成员按文档顺序排列；B：新容器追加到画布根末尾，成员按参数顺序排列 | A | 不打乱原有布局 |
| front / back 的方向（参考文档为"同级最前/最后"） | A：front 移到兄弟序列末尾（最后绘制，显示在最上层），back 移到首位；B：按序列位置字面理解，front 移到首位 | A | SVG 中后绘制者在上层，A 符合"置于顶层"的习惯含义 |
| addto 的目标已是图形的父容器 | A：移到该容器末尾，不报错；B：报错 | A | 与"作为最后一个子节点"的语义一致 |
| group 参数中有重复 id | A：报错；B：自动去重 | A | 多半是输入错误 |
| addto 的目标是该图形自身或其子孙 | A：报错，文档不变；B：不检查 | A | 参考文档未定义；不检查会使图形成为自己的祖先，图形树断开 |

## 职责边界

- 负责：`group`、`ungroup`、`addto`、`front`、`back`，及其被 undo / redo 时的回显。
- 不负责：创建时归属 `create … in`（归属图形模型、创建与删除）；undo / redo 通用规则（归属撤销与重做）。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常 | 画布根下依次为 bg、title、c1、box，`group markers c1 box` | `g#markers created with 2 children`；根下依次为 bg、title、markers，markers 内依次为 c1、box |
| 正常 | group 的成员来自不同父容器 | 全部从原父容器摘出，收入新容器 |
| 正常 | group 后 `undo` | 所有成员回到原父容器原位置，新容器消失 |
| 正常 | `ungroup` 一个非根级容器 | 子图形按原顺序提升到其父级，占据原容器的位置 |
| 正常 | `addto g1 r1` | r1 成为 g1 的最后一个子节点 |
| 正常 | `front r1` / `back r1` | r1 在同级兄弟中移到最上层 / 最下层，save 产物中元素顺序随之变化 |
| 异常 | `group bad c1 markers`（c1 在 markers 中） | `error: cannot group a container into its own descendant: markers` |
| 异常 | newGid 已存在 | `error: id already exists: g1` |
| 异常 | newGid 不合法（如 `1abc`） | 报错：id 不合法 |
| 异常 | 任一 id 不存在 | `error: no such shape: r9` |
| 异常 | `ungroup` 根级容器 | `error: cannot ungroup top-level container: scene` |
| 异常 | ungroup / addto 的目标不是容器 | `error: not a container: r1` |
| 异常 | `addto` 的目标是该图形自身或其子孙（如 `addto inner markers`，inner 在 markers 中） | 报错，文档不变 |
| 异常 | `group` 参数中有重复 id | 报错 |
| 异常 | addto 的容器不存在 | `error: no such container: g9` |
| 异常 | addto 把容器移入自身或其子孙 | 报错，状态不变 |

## 接口契约

| 命令 | 语法 | 说明 |
| --- | --- | --- |
| group | `group <newGid> <id1> <id2>…` | 新建容器并收入若干图形（从各自原父容器摘出，保持相对顺序）；整条命令为一个 undo 单元 |
| ungroup | `ungroup <gid>` | 解散容器，子图形提升到容器的父级、占据容器原位置 |
| addto | `addto <gid> <id>` | 把已有图形移入容器，作为最后一个子节点 |
| front | `front <id>` | 同级置顶 |
| back | `back <id>` | 同级置底 |

- newGid 合法字符：`[A-Za-z_][A-Za-z0-9_.-]*`，大小写敏感
- group 回显：`g#<newGid> created with <n> children`
- 错误：`id already exists`、`no such shape`、`not a container`、`cannot group a container into its own descendant`、`cannot ungroup top-level container`
