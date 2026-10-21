# 平移、缩放与属性设置

- 时间：2026-10-16
- 所属阶段：phase1

## 需求背景

用户需要修改图形的位置、大小与外观；对容器的操作应作用于其全部子孙，与对叶子的操作一视同仁（Composite）。参考：refs/phase_1.md §2.1、§3（move、scale、set）、§4.1（set 白名单）、§4.2、§6。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 容器 move / scale 的效果 | A：递归修改每个子孙的几何属性，保存的文件中不出现 `transform`；B：只修改 g 的 `transform="translate(..) scale(..)"`，子孙坐标不变 | A | 与"scale 递归到每个子孙"的语义一致；tree 显示的坐标即渲染坐标 |
| scale 的作用范围 | A：只缩放几何属性（以坐标原点为中心同乘），stroke-width 不缩放；B：stroke-width 一并缩放 | A | 需求只要求缩放"位置与尺寸" |
| set 作用于容器 | A：g 只接受 fill / stroke / stroke-width，写在 g 自身（靠 SVG 继承作用于子孙）；B：递归写入每个子孙 | A | 符合 SVG 语义，undo 简单 |
| set 白名单按类型判定 | A：属性不在该图形类型的白名单内即报错（如对 circle 设 width、对 rect 设 text）；B：只要在总白名单内即接受 | A | 参考文档只定义了总白名单 |
| set 取值校验 | A：几何属性须为数字，尺寸类不得为负；stroke-width 须为非负数；fill / stroke 不校验 | A | 与创建时的校验一致 |
| line 的 move 回显坐标 | A：起点 `(x1,y1)`；B：两端点 `(x1,y1) -> (x2,y2)` | A | 叶子回显统一为一个点 |
| set 原本未设置的属性后 undo | A：移除该属性，恢复为未设置；B：保留为 SVG 默认值 | A | 准确还原，save 产物与 set 之前一致 |

## 职责边界

- 负责：`move`、`scale`、`set`，及其被 undo / redo 时的回显。
- 不负责：归属与 z-order 调整（归属层级结构与 z-order）；undo / redo 通用规则（归属撤销与重做）。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常 | `move c1 30 0`（c1 原在 100,100） | `circle#c1 moved to (130,100)`；undo `circle#c1 moved back to (100,100)` |
| 正常 | `move node2 0 100`（容器） | `g#node2 moved by (0,100)`，其下 rect 与 text 同步平移；undo `g#node2 moved back by (0,-100)` |
| 正常 | `scale g1 2`（容器） | 所有子孙的位置与尺寸均乘以 2 |
| 正常 | `set title text "My Diagram v2"` | `text#title updated: text="My Diagram v2"`；undo `text#title updated: text="My Diagram"` |
| 正常 | `set r1 fill red` | `rect#r1 updated: fill=red` |
| 边界 | `move r1 -10 0.5` | 负数、浮点合法 |
| 异常 | id 不存在 | `error: no such shape: r9` |
| 异常 | `scale r1 0` / `scale r1 -1` | `error: scale factor must be positive` |
| 异常 | `set c1 width 10` | `error: unknown attribute: width` |

## 接口契约

| 命令 | 语法 | 说明 |
| --- | --- | --- |
| move | `move <id> <dx> <dy>` | 增量平移；容器整体平移 |
| scale | `scale <id> <factor>` | factor 同乘到全部几何属性；容器递归到每个子孙；factor 须为正数 |
| set | `set <id> <attr> <value>` | 设置白名单内的属性 |

**set 白名单**

| 类型 | 可设置属性 |
| --- | --- |
| 全部类型 | `fill` `stroke` `stroke-width` |
| rect | `x` `y` `width` `height` |
| circle | `cx` `cy` `r` |
| ellipse | `cx` `cy` `rx` `ry` |
| line | `x1` `y1` `x2` `y2` |
| text | `x` `y` `text`（文本内容） |

**回显**

- move 叶子：`<type>#<id> moved to (x,y)`；undo `… moved back to (x,y)`；坐标取 rect / text 的 `(x,y)`、circle / ellipse 的 `(cx,cy)`，line 的起点 `(x1,y1)`
- move 容器：`g#<id> moved by (dx,dy)`；undo `g#<id> moved back by (-dx,-dy)`
- set：`<type>#<id> updated: <attr>=<value>`（text 内容加双引号）；undo 同格式，值为旧值
- 错误：`error: no such shape: <id>`、`error: scale factor must be positive`、`error: unknown attribute: <attr>`
