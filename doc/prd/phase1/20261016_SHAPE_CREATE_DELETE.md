# 图形模型、创建与删除

- 时间：2026-10-16
- 所属阶段：phase1

## 需求背景

编辑器内置 6 种图形，容器 `g` 与叶子图形组成树（Composite）。`create` 负责创建图形，可通过 `in` 子句在创建时直接指定父容器；`delete` 负责删除。参考：refs/phase_1.md §0.1、§2、§3（create、delete）、§4.1、§4.2。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 参数取值校验（原文未定义） | A：几何参数须为数字；尺寸类（width/height/r/rx/ry）不得为负；颜色值不校验、原样写入；B：只校验是否为数字 | A | 负尺寸在 SVG 中非法 |
| 可选颜色位上出现 `in`（如 `create rect r1 0 0 10 10 in`） | A：一律视为关键字，其后须跟容器 id，否则报错；B：其后跟了 id 才视为关键字，否则当作颜色值 | A | `in` 不是有效颜色，作为颜色值多半是输入错误；规则简单（`in` 为保留字），不需要改分词 |
| 根级图形 undo 回显中的父节点 | A：写作 `svg`（如 `rect#r1 restored into svg`）；B：省略 into 子句 | A | 与 show 中根级图形的 `parent=svg` 一致 |
| id 合法字符 | A：`[A-Za-z_][A-Za-z0-9_.-]*`，不合法时报错；B：任意非空白串 | A | 兼容 `start-label` 等写法，符合 XML id 习惯；create 是首个接收 id 的命令，规则随之归属本需求 |

## 职责边界

- 负责：6 种图形的属性定义、id 合法字符与唯一性、`create`（含 `in`）、`delete`、两者被 undo/redo 时的回显。
- 不负责：复合图形 `box`（后续插件化阶段，本阶段按未注册类型报错）；属性修改（归属平移、缩放与属性设置）；事后调整归属（归属层级结构与 z-order）；undo/redo 的通用规则（归属撤销与重做）。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常 | `create rect r1 10 20 100 50 #eee` | `rect#r1 created`，挂在画布根末尾 |
| 正常 | `create text t1 20 40 "My Diagram"` | `text#t1 created`，内容为子文本 |
| 正常 | `create g node1` 后 `create rect start 120 100 160 60 #4a90d9 in node1` | `rect#start created in g#node1`，成为 node1 的最后一个子节点 |
| 正常 | 省略 fill / stroke | 不写入该属性 |
| 正常 | `delete box`（box 在 markers 中） | `rect#box deleted` |
| 正常 | 上一步后 `undo` | `rect#box restored into g#markers`，回到原父容器的原位置 |
| 边界 | `delete` 容器 | 连同全部子孙删除，子孙 id 均不可再访问；undo 后全部恢复 |
| 边界 | id 大小写不同（`R1` 与 `r1`） | 视为不同 id |
| 边界 | `create rect start-label 0 0 1 1` | id 合法：`rect#start-label created` |
| 异常 | `create rect 1abc 0 0 1 1` | 报错：id 不合法 |
| 异常 | id 已存在 | `error: id already exists: r1` |
| 异常 | delete 的 id 不存在 | `error: no such shape: r9` |
| 异常 | `in` 目标不存在 | `error: no such container: node9` |
| 异常 | `in` 目标不是 g | `error: not a container: start` |
| 异常 | `create hexagon h1` / `create box n1 …` | `error: unknown shape type: hexagon (is the plugin loaded?)` |

## 接口契约

**图形属性**

| 类型 | 几何属性 | 备注 |
| --- | --- | --- |
| rect | `x` `y` `width` `height` | |
| circle | `cx` `cy` `r` | |
| ellipse | `cx` `cy` `rx` `ry` | |
| line | `x1` `y1` `x2` `y2` | |
| text | `x` `y` + 文本内容 | 内容为子文本节点 |
| g | 无 | 容器 |

所有类型可带外观属性 `fill`、`stroke`、`stroke-width`，未设置时不写入。

**id**：合法字符 `[A-Za-z_][A-Za-z0-9_.-]*`，大小写敏感，全文档唯一（含容器 g）。

**create**：`create <type> <id> [params…] [in <containerId>]`

| type | 参数 | 对应 SVG |
| --- | --- | --- |
| rect | `<x> <y> <w> <h> [fill]` | `<rect id="r1" x="10" y="20" width="100" height="50" fill="#eee"/>` |
| circle | `<cx> <cy> <r> [fill]` | `<circle id="c1" cx="100" cy="100" r="20" fill="red"/>` |
| ellipse | `<cx> <cy> <rx> <ry> [fill]` | `<ellipse …/>` |
| line | `<x1> <y1> <x2> <y2> [stroke]` | `<line …/>` |
| text | `<x> <y> "content"` | `<text id="t1" x="20" y="40">My Diagram</text>` |
| g | 无 | `<g id="scene"/>` |

- 回显：`<type>#<id> created`；带 `in` 时 `<type>#<id> created in g#<containerId>`

**delete**：`delete <id>`

- 回显：`<type>#<id> deleted`；undo 回显 `<type>#<id> restored into <父节点>`，父节点为画布根时写作 `svg`
