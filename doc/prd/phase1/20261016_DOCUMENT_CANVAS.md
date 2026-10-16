# 文档生命周期与画布

- 时间：2026-10-16
- 所属阶段：phase1

## 需求背景

编辑器同一时刻至多持有一个"当前文档"（一张画布 + 图形树），所有编辑与显示命令都作用于它。本需求定义文档的创建、画布尺寸的查看与修改，以及没有文档时的约束；`init` / `canvas` 是首批由占位替换为真实实现的命令。参考：refs/phase_1.md §3（init、canvas）、§4.2。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| `init` / `canvas` 的参数个数 | A：只接受 0 个或 2 个，1 个报 usage；B：只给 w 时 h 取默认值 | 待定（推荐 A） | 语义明确 |
| 修改尺寸时 `viewBox` 如何处理 | A：同步改为 `0 0 w h`；B：保持不变 | 待定（推荐 A） | 保持 1 单位 = 1px，图形不随画布尺寸被拉伸 |
| `init` 覆盖已有文档是否提示 | A：直接覆盖；B：打印 warning 后覆盖 | B | 覆盖会丢弃未保存的内容，至少要提示；不做确认交互，脚本仍可回放 |

## 职责边界

- 负责：`init`、`canvas`、"无文档"约束。
- 不负责：`read` / `save`（归属 SVG 文件读写）；文档类命令执行后的 undo/redo 禁止规则（归属撤销与重做，本需求只声明 `init` 与 `canvas <w> <h>` 属于文档类命令）。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常 | 无文档，`init` | `canvas 800x600 created` |
| 正常 | 无文档，`init 400 200` | `canvas 400x200 created` |
| 正常 | 已有文档，`canvas` | 显示当前尺寸 |
| 正常 | 已有文档，`canvas 1024 768` | 画布尺寸更新，随后 `canvas` 显示 1024x768 |
| 边界 | 已有文档，再次 `init` | 先输出一行 `warning: …`（提示旧文档被丢弃），再输出 `canvas <w>x<h> created`；旧文档被替换 |
| 边界 | `init 100.5 200` | `canvas 100.5x200 created` |
| 边界 | 无文档时执行 `canvas a 0` | 只报"无文档"（无文档先于参数格式） |
| 边界 | 已有文档，`canvas 0 600` 失败 | 画布尺寸不变 |
| 异常 | 无文档，执行 init / read / help / exit / quit 以外的命令 | `error: no document. use 'init' or 'read' first` |
| 异常 | `init 400` | 报错：参数个数不符，并提示语法（取决于决策） |
| 异常 | `init a 600` | 报错：参数不是数字 |
| 异常 | `init 0 600` / `canvas -1 600` | 报错：尺寸须为正数 |

## 接口契约

| 命令 | 语法 | 类别 | 输出 |
| --- | --- | --- | --- |
| init | `init [w] [h]` | 文档类 | `canvas <w>x<h> created`；默认 800×600；已有文档时先输出一行警告 |
| canvas | `canvas` | 显示类 | 当前尺寸 |
| canvas | `canvas <w> <h>` | 文档类 | 修改后的尺寸 |

- 画布尺寸对应 SVG 根元素的 `width` / `height`，须为正数
- "无文档"错误：`error: no document. use 'init' or 'read' first`；不要求文档的命令：init、read、help、exit、quit
