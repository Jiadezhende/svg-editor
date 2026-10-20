# FEAT：显示命令（tree / show）

- 提案时间：2026-10-20
- 完成时间：2026-10-20
- 类型：FEAT
- 关联 prd：doc/prd/phase1/20261016_DISPLAY.md

<!-- 提案阶段：动因、决策记录、数据模型、架构 / 流程设计，讨论确认后方可进入开发 -->

## 动因

本次实现 DISPLAY 需求：把 `tree`、`show` 由占位替换为真实实现。

PRD 已把显示统一为：tree 只显示核心属性（全名 `名=值`），show 显示全部已设置的属性，所以显示可以由属性表通用生成，叶子类不需要各写一套格式。需要确定的是：

- 核心属性在哪里声明；
- text 内容加引号这一处差异放在哪里；
- tree 的连线由谁绘制。

前置：SHAPE_CREATE_DELETE 已完成（图形树、属性表、`asContainer()`、`parent()`、`label()`）。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 核心属性在哪里声明 | A：就是图形类已声明的 `params`（create 必填参数），不新增声明；B：在属性种类上加"是否核心"的标记 | A | 目前核心属性与必填参数完全一致，A 不引入新概念；将来若出现两者不一致的类型（如插件），再加标记 |
| text 内容加引号放在哪 | A：新增属性种类 `TextSpec`（继承 StringSpec），输出时加双引号；B：Text 类覆盖显示方法 | A | 按属性种类的划分规则（至少一项操作行为不同就拆），text 内容与 fill / stroke 的输出格式已经不同；A 让显示保持对属性表的通用处理，叶子类不需要覆盖 |
| tree 连线的绘制放在哪 | A：TreeCommand 遍历图形树，通过 `asContainer()` 取子节点，负责连线符号与缩进；图形只提供本行的内联属性；B：放在 Shape / Group 中递归生成 | A | 连线符号是 tree 这一种输出的排版，不属于图形本身；遍历对容器与叶子一视同仁（叶子 `asContainer()` 为 null，即没有子节点），不需要判断类型 |

## 数据模型

| 位置 | 类 | 变更 | 职责 |
| --- | --- | --- | --- |
| backend/receiver/document/attribute | `TextSpec` | 新增 | 继承 StringSpec，`format` 输出时加双引号（`"My Diagram"`） |
| backend/receiver/document/shape | `Text` | 修改 | 内容 `text` 的属性种类由 StringSpec 改为 TextSpec |
| backend/receiver/document/shape | `Shape` | 修改 | 新增 `summary(): string`（tree 内联：核心属性）、`details(): string[]`（show：核心属性行，外观属性行在有外观属性时才有）；核心属性行由 protected `coreDetail()` 生成，默认为 `params` 依次 `名=值` |
| backend/receiver/document/shape | `Group` | 修改 | 覆盖 `coreDetail()` 为 `children=<n>`（只用于 show；tree 中 g 不内联属性） |
| backend/command/impl | `TreeCommand` | 占位 → 实现 | 构造时解析 0 或 1 个参数；执行时：无参以 Document 为根，首行 `svg (<w>x<h>)`；有参以该图形为根，首行为该图形本行；逐层绘制连线 |
| backend/command/impl | `ShowCommand` | 占位 → 实现 | 构造时解析 1 个参数；执行时：首行 `<type>#<id>  parent=<父节点 label>`，其后为 `details()` 各行，缩进 2 格 |

tree 每行的格式：`<连线前缀><type>#<id>`，`summary()` 非空时再接 2 个空格和摘要，行尾不留空白。

示例输出（与 PRD 接口契约一致）：

```text
svg (800x600)
├── rect#bg  x=0 y=0 width=800 height=600
├── text#title  x=20 y=40 text="My Diagram"
└── g#markers
    ├── circle#c1  cx=100 cy=100 r=20
    └── rect#box  x=200 y=80 width=60 height=60
```

## 架构 / 流程设计

模块划分与依赖规则不变。本次新增 / 修改的文件：

```text
src/backend/
├── command/impl/
│   ├── TreeCommand.ts              占位 → 实现
│   └── ShowCommand.ts              占位 → 实现
└── receiver/document/
    ├── attribute/
    │   └── TextSpec.ts             新增
    └── shape/
        ├── Shape.ts                新增 summary / details / coreDetail
        ├── Group.ts                覆盖 coreDetail
        └── Text.ts                 内容改用 TextSpec
```

### tree 的绘制

```text
draw(node, prefix):
  children = node 的子节点（Document 直接取；图形经 asContainer()，叶子没有子节点）
  对第 i 个子节点 child：
    last = 是否最后一个
    输出 prefix + (last ? "└── " : "├── ") + child 本行
    draw(child, prefix + (last ? "    " : "│   "))
```

显示类命令直接继承 `Command`，不继承 `EditCommand`，因此不可撤销；是否进入撤销栈的规则随撤销需求落地。

### 变化点

| 变化点 | 预留 |
| --- | --- |
| 插件类型（box） | 声明 `params` 即自动获得 tree / show 显示；核心属性与必填参数不一致时，再在属性种类上加"核心"标记 |
| set 修改属性后 | 显示直接读取当前属性值，不需要额外同步 |
| save | text 内容在 SVG 中写成子文本，不使用 TextSpec 的带引号输出，由 SVG 读写需求处理 |

### 本次不做

- `canvas` 无参显示（已在 DOCUMENT_CANVAS 完成）、`help`（已在 CLI_REPL 完成）。

<!-- 开发阶段：补齐以下内容；上方已确认的决策不得改动 -->

## 测试与验证

`npm test`：27 个测试文件、239 个用例全部通过；`npm run typecheck` 无错误；本次新增与修改的类行覆盖率均为 100%。

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 接口契约示例文档 `tree`：首行 `svg (800x600)`，每行内联核心属性全名，不含外观属性，与示例一致 | 单元测试（TreeCommand）+ 子进程（main.test） | 通过 |
| `tree markers` 只输出 markers 子树，首行为 `g#markers`；`tree <叶子 id>` 只输出该行 | 单元测试（TreeCommand）+ 子进程 | 通过 |
| 多层嵌套时连线符号 `├── ` `└── ` `│   ` `    ` 正确；标签与属性间固定 2 个空格，g 行尾无空白 | 单元测试（TreeCommand） | 通过 |
| `show c1` 与接口契约示例一致：`circle#c1  parent=g#markers` / `  cx=100 cy=100 r=20` / `  fill=red` | 单元测试（ShowCommand）+ 子进程 | 通过 |
| show：根级图形 `parent=svg`；未设置外观属性时省略外观行；外观行按 fill / stroke / stroke-width 顺序；text 内容加双引号；g 为 `children=<n>` | 单元测试（ShowCommand、Shape、Group、Leaves） | 通过 |
| 空文档 `tree` 只输出 `svg (<w>x<h>)`（尺寸按数值格式）；空容器 `tree g1` 只输出 `g#g1` | 单元测试（TreeCommand） | 通过 |
| id 不存在时 `tree` / `show` 报 `error: no such shape: r9` | 单元测试（TreeCommand、ShowCommand）+ 子进程 | 通过 |
| 无文档时报"无文档"；参数个数不符时报错并附语法 | 单元测试（TreeCommand、ShowCommand）+ 子进程 | 通过 |
| 显示类命令不改变文档；delete 后 tree 反映新结构 | 单元测试（TreeCommand）+ 子进程 | 通过 |

实现中补齐的细节（未改动已确认的决策）：

- 去掉了 SHAPE_CREATE_DELETE 中只供测试使用的 `Shape.attributes()`（按属性给出名字与输出文本），由 `summary()` / `details()` 取代，相关测试改为断言显示结果；
- TreeCommand 的首行使用 `Document.label()`（`svg`）拼接画布尺寸。

## 遗留问题

- "显示类命令不进入 undo 栈、不影响 undo / redo 禁止状态"目前由"不继承 EditCommand"保证；Invoker 的具体规则随撤销需求落地后再端到端验证。
- 属性种类的 `format` 现在表示"显示用的输出"：TextSpec 输出带引号。SVG 读写需求中，text 内容写成子文本、数值写成属性时，需要确认是否复用 `format`，或单独定义序列化方式。
