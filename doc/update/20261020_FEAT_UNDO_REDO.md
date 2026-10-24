# FEAT：撤销与重做

- 提案时间：2026-10-20
- 完成时间：2026-10-20
- 类型：FEAT
- 关联 prd：doc/prd/phase1/20261016_UNDO_REDO.md

<!-- 提案阶段：动因、决策记录、数据模型、架构 / 流程设计，讨论确认后方可进入开发 -->

## 动因

本次实现 UNDO_REDO 需求：把内置命令 `undo` / `redo` 由占位替换为真实实现，在 Invoker 中加入撤销栈、重做栈，以及"文档类命令后禁止撤销、下一次编辑成功后解禁"的规则。

需要确定的是：

- Invoker 执行完一条命令后，如何得知它属于编辑类（入栈）、文档类（清空并禁止）还是显示类（不影响）；
- `canvas`（查看尺寸，显示类）与 `canvas <w> <h>`（修改尺寸，文档类）目前是同一个类，类别随参数变化，无法只靠类型区分。

前置：

- SHAPE_CREATE_DELETE 已提供 `EditCommand.undo()`，并约定 redo 即再次调用 `execute()`；
- DOCUMENT_CANVAS 的变化点：`canvas` 无参为显示类、带参为文档类，须加以区分。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| Invoker 如何区分命令类别 | A：双分派：命令执行成功后，Invoker 调用 `command.recordTo(history)`，由命令自己决定对历史做什么；B：Invoker 按类型判断，只有两条分支：EditCommand 入撤销栈，DocumentCommand 清空并禁止，其余（显示类）不处理；C：命令声明类别标签，Invoker 按标签分支 | B | 行为上只有两条分支，判断集中在 Invoker 一处最直观，不需要额外的 History 接口与 `recordTo` 钩子；C 是课程禁止的 `switch(tag)` |
| 文档类命令的类层次 | A：新增抽象类 `DocumentCommand extends Command`，init、read、save、修改画布尺寸继承它；B：不新增基类 | A | Invoker 需要可判断的类型；与 EditCommand 对称 |
| canvas 查看与修改尺寸 | A：拆成两个类型：`CanvasShowCommand`（显示类）与 `CanvasResizeCommand`（继承 DocumentCommand），命令语法不变；B：保持一个类，DocumentCommand 声明 `changesDocument()`，canvas 无参时返回 false；C：命令行上拆成两个命令名 | A | `canvas` 与 `canvas <w> <h>` 本来就是两条命令，应当是两个类型；执行端（命令、Invoker）对此无感知，按参数区分只发生在命令分发；C 改变课程规定的语法 |
| 同名命令如何按参数选择类型 | A：命令类以静态 `accepts(args)` 声明本形式接受哪些参数（只看结构，如个数），默认接受任意参数；Client 对同名的全部形式逐一匹配，**唯一命中**才采用：0 个命中报参数个数不符并列出该命令的全部语法，多个命中属于程序缺陷；B：按注册顺序取第一个命中的形式；C：以构造函数的完整校验作为匹配条件 | A | 不依赖注册顺序（目前由文件名排序决定，过于隐蔽）；只按结构匹配，内容错误（如 `canvas a b` 的 `not a number: a`）仍由命中形式的构造函数报出，报错明确；只有一个形式的命令（含变长参数的 create、group）沿用默认实现，行为不变 |

## 数据模型

| 位置 | 类 | 变更 | 职责 |
| --- | --- | --- | --- |
| backend/command | `Command` | 修改 | 新增静态 `accepts(args): boolean`，默认 true |
| backend/command | `DocumentCommand` | 新增 | 文档类命令的抽象基类，供 Invoker 判断类型 |
| backend/command/impl | `InitCommand` | 修改 | 改为继承 DocumentCommand |
| backend/command/impl | `CanvasCommand` | 删除 | 拆为下面两个类 |
| backend/command/impl | `CanvasShowCommand` | 新增 | `canvas`：显示当前尺寸；`accepts`：无参 |
| backend/command/impl | `CanvasResizeCommand` | 新增 | `canvas <w> <h>`：修改尺寸；继承 DocumentCommand；`accepts`：有参（个数由构造函数校验，`canvas 400` 报其语法） |
| backend/invoker | `Invoker` | 修改 | 持有撤销栈、重做栈与禁止标志；`execute(command)` 执行成功后按类型分两支处理历史；新增 `undo()` / `redo()` |
| backend | `Client` | 修改 | 命令表改为"命令名 → 该名下的全部形式"，按 `accepts` 唯一命中选择；注册时同名多形式的类都须覆盖 `accepts`，否则启动即失败；`help` 逐个列出各形式的 usage；内置命令 `undo` / `redo` 改为调用 Invoker |

## 架构 / 流程设计

模块划分与依赖规则不变（Invoker 依赖 EditCommand、DocumentCommand 两个基类，仍是 invoker → command）。本次修改了 CLI_REPL 中"一个命令名对应一个类"的约定：一个命令名可以对应多个形式，由 Client 按参数结构选择。本次新增 / 修改的文件：

```text
src/backend/
├── Client.ts                       同名多形式的匹配；undo / redo 接入 Invoker
├── invoker/
│   └── Invoker.ts                  两个栈 + 禁止标志，按类型分两支
└── command/
    ├── Command.ts                  新增静态 accepts
    ├── DocumentCommand.ts          新增
    └── impl/
        ├── InitCommand.ts          改继承 DocumentCommand
        ├── CanvasCommand.ts        删除
        ├── CanvasShowCommand.ts    新增
        └── CanvasResizeCommand.ts  新增
```

### 命令分发

```text
execute(tokens):
  内置命令命中 → 照旧
  forms = 命令名下的全部形式；没有 → unknown command
  matched = forms 中 accepts(args) 为真的那些
  matched 为 0 个 → wrong number of arguments. usage: <各形式 usage 以 " | " 连接>
  matched 多于 1 个 → 程序缺陷（普通 Error）
  否则 → new matched[0](workspace, args)，交给 Invoker
```

示例：`canvas` → CanvasShowCommand；`canvas 1024 768` → CanvasResizeCommand；`canvas a b` → CanvasResizeCommand，由其构造函数报 `not a number: a`；`canvas 400` → CanvasResizeCommand，报 `wrong number of arguments. usage: canvas <w> <h>`。

### 执行流程

```ts
execute(command: Command): CommandResult {
  const result = command.execute();          // 失败时抛出异常，历史不变
  if (command instanceof EditCommand) {
    this.undoStack.push(command);            // 入撤销栈
    this.redoStack = [];                     // 清空重做栈
    this.sealed = false;                     // 解禁
  } else if (command instanceof DocumentCommand) {
    this.undoStack = [];
    this.redoStack = [];
    this.sealed = true;                      // 禁止 undo / redo
  }
  return result;                             // 显示类：不处理
}
```

### undo / redo

| 操作 | 禁止中 | 栈为空 | 正常 |
| --- | --- | --- | --- |
| `undo` | `error: undo not allowed after io command` | 报"无可撤销" | 弹出撤销栈顶，调用其 `undo()`，压入重做栈，返回其回显 |
| `redo` | 报"io 命令后不允许 redo" | 报"无可重做" | 弹出重做栈顶，再次调用其 `execute()`，压入撤销栈，返回其回显 |

- 判断顺序为先"禁止中"、后"栈为空"。无文档时从未执行过文档类命令，不会处于禁止状态，所以按空栈报错，符合 DOCUMENT_CANVAS 的约定。
- undo / redo 本身不经过 `execute(command)` 的分支：它们是内置命令，只在两个栈之间移动已有命令。

### 变化点

| 变化点 | 预留 |
| --- | --- |
| read / save 落地 | 继承 DocumentCommand 即自动获得"清空并禁止" |
| 新增命令类别 | 需要在 Invoker 中增加分支（已接受的代价） |
| 其他同名多形式的命令 | 各形式覆盖 `accepts` 即可，Client 不改 |
| 后续编辑命令（move、scale、set、group 等） | 继承 EditCommand 即自动入栈 |

### 本次不做

- read / save 仍为占位（随 SVG 读写落地时改为继承 DocumentCommand）；
- PRD 中以 move、group 为例的 cases 随各自命令落地后验证，本次以 create / delete 验证同样的规则。

<!-- 开发阶段：补齐以下内容；上方已确认的决策不得改动 -->

## 测试与验证

`npm test`：28 个测试文件、258 个用例全部通过；`npm run typecheck` 无错误；本次新增与修改的类行覆盖率均为 100%。

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 编辑命令 → `undo` → `redo`：undo 回显为该命令的撤销回显，redo 回显与原命令相同（以 create / delete 验证，move 随其命令落地后补） | 单元测试（Invoker）+ 子进程（main.test） | 通过 |
| 一条编辑命令 = 一个 undo 单元；undo 后文档状态（属性值、父容器、兄弟间顺序）与执行前一致（delete 容器后 undo，tree 与删除前相同；group 随其命令落地后补） | 子进程 | 通过 |
| `undo` → 新的编辑命令 → `redo`：重做栈已清空，报 `nothing to redo` | 单元测试（Invoker） | 通过 |
| 编辑命令执行失败（如 id 重复）：不入栈、不清空重做栈、不改变禁止状态 | 单元测试（Invoker）+ 子进程 | 通过 |
| tree / show / help / `canvas`（无参）不影响任何 undo / redo 行为 | 单元测试（Invoker）+ 子进程 | 通过 |
| 文档类命令（init、`canvas <w> <h>`）后 `undo` 报 `error: undo not allowed after io command`，`redo` 报 `error: redo not allowed after io command` | 单元测试（Invoker）+ 子进程 | 通过 |
| 文档类命令后执行一次成功的编辑命令即解禁，且只能撤销之后的编辑（之前的历史已清空） | 单元测试（Invoker）+ 子进程 | 通过 |
| 栈为空时 `undo` / `redo` 报 `nothing to undo` / `nothing to redo`；无文档时同样按空栈报错 | 单元测试（Invoker、Client）+ 子进程 | 通过 |
| 同名多形式：按 `accepts` 唯一命中选择，与注册顺序无关；无命中报参数个数不符并列出全部语法；多个命中为程序缺陷；同名多形式中有形式未覆盖 `accepts` 时启动即失败 | 单元测试（Client） | 通过 |
| canvas 两种形式：`canvas` 查看、`canvas 1024 768` 修改；`canvas 400` 报 `usage: canvas <w> <h>`；`canvas a b` 报 `not a number: a`；help 中各占一行 | 单元测试（CanvasShowCommand、CanvasResizeCommand）+ 子进程 | 通过 |

实现中补齐的细节（未改动已确认的决策）：

- 原 CanvasCommand 的测试按两个形式拆分；`canvas` 无参的回显 `canvas <w>x<h>`、带参的回显 `canvas resized to <w>x<h>` 不变；
- CLI_REPL 的命令表中 canvas 的语法改为 `canvas`、`canvas <w> <h>` 两种形式；
- 文案：空栈 `nothing to undo` / `nothing to redo`；禁止中的 redo 为 `redo not allowed after io command`。

## 遗留问题

- PRD 中以 move、group 为例的 cases 只以 create / delete 验证了同样的规则，move、group 落地后需在其提案中补充端到端验证。
- read / save 仍为占位，落地时须改为继承 DocumentCommand。
- 同名形式之间的互斥目前靠各形式自己保证，重叠只在实际输入时才会作为程序缺陷暴露（canvas 的两种形式已由单元测试验证互斥）。
