# SVG Editor

课程 Lab1 的 TypeScript 命令行 SVG 编辑器。仓库按产品拆分：CLI 位于 [`cli/`](../cli/)，VS Code 扩展位于 [`vscode-extension/`](../vscode-extension/)，两者各自安装、构建和测试。本分支完成 Phase 2 CLI 与 VS Code 扩展，当前内核能力、装配方式、扩展实现和验收证据见下文。Phase 1 的设计记录保留为历史基线。

Phase 1 基线是同一仓库的 `final` 标签。 [项目仓库](https://github.com/Jiadezhende/svg-editor)

## 项目背景

本项目是课程 Lab1 的工程实践：用 TypeScript 实现一个**命令行 SVG 编辑器**，在 REPL（提示符 `svg>`）中通过命令创建、编辑、组织矢量图形，并以标准 SVG 文件读写。

### 为什么是 SVG

SVG 是用 XML 文本描述矢量图形的格式：纯文本、树形结构（`<g>` 容器嵌套子图形），保存出的文件可直接在浏览器或 VSCode 中预览。它天然具备两个适合做架构练习的特征：

- **树形组合结构**：容器与叶子图形需要被统一操作（移动、缩放、设置属性、删除），是 Composite 语义的典型场景；
- **可寻址性**：图形以唯一 `id` 定位，使 CLI、agent、鼠标等不同输入通道都能无歧义地回答"改哪个图形"。

### 项目目标

功能本身不是考察重点，重点在于**与 AI 协作完成一个架构良好、恰当使用设计模式的应用**：

- **架构**：清晰的模块划分与依赖方向，识别并为变化点预留扩展余地；
- **设计模式**：编辑操作以 Command 模式实现，支持 undo / redo；图形树体现 Composite 语义；
- **编程范式**：面向对象（类层次 + 多态、字段封装、一类一文件），避免贫血模型与按类型名到处分派的过程式写法；
- **过程可追溯**：git 分步提交，记录与 AI 协作中的关键讨论、问题发现与纠正。

## Phase 2 CLI

本阶段的工作包、进度和验收清单见 [Phase 2 需求总纲](prd/phase2/20261125_PHASE2_DELIVERY.md)。

### 运行与配置

使用 Node.js 22.14 或更新的兼容版本。本轮使用 Node.js 22.23.2 验收。

```bash
cd cli
npm install
npm run cli -- --config plugins.config.json
npm run cli:code
npm run cli -- --config test/fixtures/transcript/phase1.plugins.json
npm test
npm run typecheck
npm run verify:transcripts
```

`npm run cli` 要求传入 `--config <path>`。仓库配置按顺序启用 `core`、`stats`、`dir`、`modified-star`、`box`。`cli:code` 在 [代码装配入口](../cli/src/cli-code.ts) 静态导入同一套插件，再逐包调用 `registerPlugin`。代码装配可以传入插件的激活函数，也可以直接传入已有的四类贡献对象。

配置文件只含 `plugins` 数组。每项声明 `module`，可选 `enabled` 和 `options`。

```json
{
  "plugins": [
    { "module": "./plugins/core" },
    { "module": "./plugins/stats", "enabled": false },
    { "module": "./plugins/dir" },
    { "module": "./plugins/modified-star" },
    { "module": "./plugins/box", "options": {} }
  ]
}
```

相对路径从配置文件所在目录解析，可指向声明了 `main` 的插件目录或已有包的入口文件。包名由 Node ESM 以配置文件为解析基准解析。禁用项跳过模块解析和求值。选项对象交给入口默认导出的同步 `activate(options)`，省略时使用空对象。当前发行插件使用自身默认行为。`plugins: []` 只保留 `help`、`undo`、`redo`、`exit`、`quit`。配置整体无效时报告 `error: invalid plugin config` 并装配 `core`。单包失败后继续装配后续包。 [插件编写示例](../cli/docs/plugins.md)

### 架构说明

CLI 的详细架构——分层、领域模型、命令生命周期、SVG 持久化、装配、设计模式与依赖规则——见 [cli/docs/architecture.md](../cli/docs/architecture.md)。本 README 只保留运行、验收与过程记录，不重复架构细节。

扩展点与插件包格式见该文档的「扩展点」一节和 [插件编写说明](../cli/docs/plugins.md)。

### 决策记录

- [属性处理器与局部撤销](adr/phase2-01-attributes.md)
- [复合图形的读回、降级和私有部件](adr/phase2-02-box-readback.md)
- [树标签的保存基准和传播范围](adr/phase2-03-modified-star.md)
- [插件注册与配置失败的边界](adr/phase2-04-plugin-assembly.md)

### 验收证据与指标

- `npm run verify:transcripts` 比较代码和配置装配的标准输出及保存的 SVG。基础会话只启用 `core`，另与 `final` 中的实际程序输出逐字节比较。`dir` 在同一临时工作目录和固定目录项上运行，输出样本保存在工作目录之外。 [命令输入、期望输出与 SVG 样例](../cli/test/fixtures/transcript/)
- `b8b45dd` 是 `box` 接入前的共同基准。`9e1edd1` 加入插件、测试和配置项。`3124971` 位于本地 `codex/phase-2-cli-code-demo`，加入同一份插件和测试，并修改单个代码装配入口。 [配置装配差异](#box-接入差异复核)
- 源码指标按内核、装配、插件分类，通过脚本对 Git 提交生成文件清单、职责、行数和圈复杂度增量。 [框架节点报告](../docs/metrics/framework.md) [CLI 候选报告](../docs/metrics/cli-candidate.md)

```bash
node cli/scripts/phase2-metrics.mjs final b1d929c
```

完整交付后可将目标提交替换为 `p2`。当前 CLI 的 Vitest 结果为 62 个测试文件、564 项通过，类型检查通过。

#### box 接入差异复核

以下命令核对重构前的历史提交，路径保持当时的仓库布局；当前源码位于 [`cli/`](../cli/)。

```bash
git diff --name-status b8b45dd 9e1edd1
git diff --name-status b8b45dd 3124971
git diff --exit-code b8b45dd 9e1edd1 -- src/backend src/bootstrap.ts src/pluginConfig.ts plugins ':(exclude)plugins/box'
git diff --exit-code b8b45dd 3124971 -- src/backend src/bootstrap.ts src/pluginConfig.ts plugins ':(exclude)plugins/box'
git diff --exit-code 9e1edd1 3124971 -- plugins/box
```

最后三条的差异均为空。

### AI 协作检查

- 初版建议恢复注册上下文。复查原有宿主和直调测试后，确认 `registerPlugin` 已承担代码装配。按反馈保留贡献数组入口，配置加载器只负责解析模块并把激活函数交给宿主。
- 对照课程会话检查复合图形视图。文档节点只保存可编辑成员，树和统计经不可变视图读取私有部件。两份接入提交的差异验证了新增插件对内核、加载器和既有插件的影响为零。
- 在临时 `node_modules` 中测试只声明 ESM 导出的包。真实进程暴露了 tsx 解析钩子要求父路径使用 URL 字符串的问题，修正后相对路径、包名和失败恢复一并通过回归。
- 使用 Git 中的 `final` 运行基础会话，以程序输出核对兼容性。课程示例中的展示格式可作为语义参考，`box` 沿用通用创建与属性命令的回显。


## Phase 2 VS Code 扩展

Phase 2 第一部分是独立的 VS Code 扩展，入口在 [`vscode-extension/`](../vscode-extension/)。它不属于 CLI 插件，也不引用 `cli/src` 或 `cli/plugins`。

- 功能：Explorer 对 `.svg` 显示 `[]`；原生 Outline 展示 SVG 元素层级并定位源码。
- 架构与设计：[vscode-extension/docs/architecture.md](../vscode-extension/docs/architecture.md)
- 验收与证据：[vscode-extension/docs/acceptance.md](../vscode-extension/docs/acceptance.md)
- 扩展入口：[vscode-extension/README.md](../vscode-extension/README.md)
- VS Code 指标：[vscode-metrics.md](../vscode-extension/docs/evidence/vscode-metrics.md)
- 需求：[A.1 文件标记](prd/phase2/20261125_VSCODE_FILE_BADGE.md) · [A.2 原生大纲](prd/phase2/20261125_VSCODE_OUTLINE.md) · [A.3 演示材料](prd/phase2/20261125_VSCODE_EVIDENCE.md)
- 实现提案：[update/20261127_FEAT_VSCODE_EXTENSION.md](update/20261127_FEAT_VSCODE_EXTENSION.md)
- 当前结果：扩展 16 项测试、类型检查和构建通过；CLI 回归 62 个测试文件、564 项通过。详细结果与截图见验收文档。

## Phase 1 历史基线

Phase 1 的模块划分、设计模式与依赖规则已并入 [cli/docs/architecture.md](../cli/docs/architecture.md)；`final` 标签保留当时的实现，用于回放和指标基线。Phase 2 在同一分层上增加插件装配、配置加载和公开扩展契约。

## 过程记录

开发按"需求文档（[prd/](prd/)）→ 提案（[update/](update/)）→ 开发者逐条确认决策 → 分步开发与提交 → 补齐测试与验证"的流程推进，共 8 份需求、9 份提案（含 1 份重构）。以下记录有代表性的讨论与纠正，细节见对应提案的"决策记录"。

1. **去掉 common 模块**（[REFACT_REMOVE_COMMON](update/20261016_REFACT_REMOVE_COMMON.md)）。框架提案设立了前后端共享的 `common`，里面只有 `CommandResult` 与 `EditorError` 两个类。落地后复查发现，这两个类实际都属于后端，前端经由 `common` 依赖了后端类型，"前后端互不依赖"的规则只是被目录名掩盖了。纠正：去掉 common，`CommandResult` 归入 command，`EditorError` 独立为最底层的 error，前端改用自有的 `ParseError`，由 App 负责转换。
2. **"无文档"在哪里判定**（[DOCUMENT_CANVAS](update/20261016_FEAT_DOCUMENT_CANVAS.md)）。AI 给出三个方案：命令静态声明、由 Client 检查；各命令自查；只由 Workspace 判定。开发者选择最后一个：有无文档是 Receiver 的状态，不应泄露到 Client 与命令。代价是放宽了框架中"无文档先于参数格式报错"的约定，PRD 随之修改。
3. **图形属性如何建模**（[SHAPE_CREATE_DELETE](update/20261020_FEAT_SHAPE_CREATE_DELETE.md)）。对比了三种写法："类型化字段"（每个叶子都要按属性名写 switch）、"静态属性表 + 属性种类"、"字段装饰器"。对装饰器在工具链上做了最小验证，发现 vitest 无法转译、tsc 需要改 lib 配置、运行时还缺 `Symbol.metadata`，于是选择静态属性表。之后开发者追问属性种类按什么维度抽象，AI 发现自己最初列的四个种类划分不一致：stroke-width 被归入尺寸，但两者的缩放行为不同；fill 与 text 内容的行为完全相同，却分成了两类。据此改为按"至少一项操作的行为不同才拆分"重新划分。静态成员 `geometry` 也因为 text 的内容不是几何属性，改名为 `params`。
4. **取值与展示分离**（[DISPLAY](update/20261020_FEAT_DISPLAY.md)）。AI 最初让 TextSpec 的 `format` 直接给文本加引号，这样 save 取到的也会是带引号的值。开发者指出取属性应当取真值，展示应使用独立的方法；随后又追问"format 是否多余"。最终由 `Shape.value(name)` 取原值，属性种类只保留展示用的 `display`。
5. **tree 的格式**（DISPLAY）。AI 推荐按最长的标签对齐属性列，以吻合课程示例；核对课程原文后发现示例本身就没有严格对齐，开发者改为固定空 2 格。开发者还指出 `w=`、`(x1,y1) -> (x2,y2)` 等缩写有歧义，于是 tree 统一输出必填属性的全名，完整属性由 show 提供。
6. **Invoker 如何区分命令类别**（[UNDO_REDO](update/20261020_FEAT_UNDO_REDO.md)）。AI 推荐双分派（`recordTo` + History 接口），并声称在 Invoker 中用 `instanceof` 属于课程禁止的写法。开发者追问后核对原文，课程禁止的是"到处 `switch(tag)`"，AI 的说法过于严格。开发者决定由 Invoker 直接按类型分两条分支，History 接口随之取消。讨论中又暴露出 `canvas` 一个类既是显示类又是文档类的问题；开发者指出它们本来就是两条命令，于是拆成两个类型。Client 在同名的形式中按 `accepts` **唯一命中**来选择，而不按注册顺序取第一个，因为注册顺序由文件名排序决定，不能作为优先级的依据。
7. **move 回显的锚点**（[TRANSFORM_SET](update/20261020_FEAT_TRANSFORM_SET.md)）。AI 最初用"取第一个 x 坐标与第一个 y 坐标"的通用规则。开发者指出这条规则没有保障：它依赖声明顺序，写错了也不会报错。于是改为各类显式声明 `anchor`，注册时校验。撤销方式选用备忘录而不是反向运算，因为浮点数先乘 3 再乘 1/3 不能精确还原。
8. **不必要的抽象**（[HIERARCHY_ZORDER](update/20261021_FEAT_HIERARCHY_ZORDER.md)）。AI 参照属性快照，提出新增位置备忘录类 `Placement`。开发者追问是否必要，确认父节点与位置本来就能公开取得，不像属性快照那样受封装约束，单独建类只是给一个三元组起名，于是取消。同一需求中，课程原文对"根级容器能否 ungroup"前后矛盾，且没有会话样例；开发者了解代价后，选择照 §4.2 的明文拒绝。
9. **范围收窄**（[SVG_FILE_IO](update/20261021_FEAT_SVG_FILE_IO.md)）。AI 的方案为任意外部 SVG 做了较多兼容，例如保留未知属性、识别 `px` 单位。开发者追问"需要支持这么多文件类型吗"，核对后确认课程只要求读回自身保存的文件与示例 `other.svg`，于是收窄范围，并改动了已确认的一项 PRD 决策。引入 `@xmldom/xmldom` 前做了验证，发现它默认把解析错误打印到 stderr，因此改用 `onError` 收集错误，再转为 `EditorError`。
10. **文档中的数据错误**。收尾核对时发现，4 份提案"测试与验证"中的测试文件数是 AI 估写的，并非取自实际输出。已按当时提交中的实际文件数逐一改正。此后文档中的数字一律取自命令输出。

## 一致性自查

### 模块划分

实际目录与架构说明一致。与框架提案（[CLI_REPL](update/20261016_FEAT_CLI_REPL.md)）中的预期目录相比，不一致之处均已在对应提案中记录：

| 差异 | 原因 | 记录 |
| --- | --- | --- |
| 去掉 `common/` | 共享模块掩盖了前端对后端的依赖 | REFACT_REMOVE_COMMON |
| `backend/error/` 独立成包 | EditorError 必须位于依赖最底层，而 receiver 不能依赖 command | REFACT_REMOVE_COMMON |
| `document/` 下细分 `shape/`、`attribute/` | 图形类层次与属性种类各自成组 | SHAPE_CREATE_DELETE |
| `command/` 下新增 `EditCommand`、`DocumentCommand`、`RelocateCommand` | 可撤销、文档类、移动位置三个类别基类 | SHAPE_CREATE_DELETE、UNDO_REDO、HIERARCHY_ZORDER |
| 删除 `PlaceholderCommand` | 全部命令已有真实实现 | SVG_FILE_IO |

### 依赖方向

全部需求完成后首次检查（2026-10-24），本次重构后再次复查（2026-11-27），针对 [cli/docs/architecture.md](../cli/docs/architecture.md) 中的依赖规则检索 `cli/src/` 中的 import，结果如下：

| 规则 | 检查方式 | 结果 |
| --- | --- | --- |
| frontend 与 backend 互不依赖 | frontend 中 import backend / App；backend 中 import frontend / App | 0 处 |
| receiver 不依赖 command、invoker、Client | receiver 中 import `/command/`、`/invoker/`、`Client` | 0 处 |
| invoker 只依赖 command | invoker 中 import receiver、Client | 0 处 |
| command 不依赖 invoker、Client | command 中 import invoker、Client | 0 处 |
| document 不依赖 svg、tree | document 中 import `/svg/`、`/tree/` | 0 处 |
| 第三方与系统依赖收口 | 检索 `xmldom`、`node:fs` | `xmldom` 只在 SvgReader 中；`node:fs` 只在 SvgFile 与 main.ts 中 |

command → receiver 属于允许的方向：Command 基类使用 `DecimalFormat`（命令参数与数值属性共用同一份数值规则），`EditCommand` 使用图形树与快照类型。

### 按名分派

按名分派只允许出现在命令分发（`Client.execute`）和图形工厂（`ShapeFactory`）两处；两处都位于“文本 → 对象”的边界，翻译完成后行为由多态完成。自查未发现这两处之外的业务按名分派；`Shape.attribute`、分词和格式校验属于数据查找或语法处理。逐项归类与“待重构”说明见 [cli/docs/architecture.md](../cli/docs/architecture.md) 的「依赖规则」一节。

## 质量保证手段

### 功能完整性

- **需求可追溯**：8 份 PRD 的每一条 case（正常、边界、异常）都在对应提案的"测试与验证"表中列出了用例与验证方式；课程原文中有歧义或缺失的地方，都记入 PRD 的"决策记录"，由开发者确认。
- **端到端验证**：[test/main.test.ts](../cli/test/main.test.ts) 以子进程运行真实入口，按脚本回放逐条比对回显，覆盖 10 组场景：框架、文档与画布、创建删除、显示、撤销重做、平移缩放设置、层级与 z-order、文件读写等，并断言 stderr 为空。文件读写场景使用临时目录，读入的正是课程给出的 `other.svg`。
- **与课程示例逐字对照**：save 产物与课程的文件格式示例逐字一致；读入 `other.svg` 的警告、元素数与 tree 都与示例一致（见 SvgWriter / SvgReader 的测试）。

### 代码质量

- **测试**：`npm test` 共 62 个测试文件、564 个用例全部通过。每个类都有单元测试，测试目录与 `cli/src/` 一一对应。总体覆盖率：语句 88.54%、分支 82.80%、函数 92.98%、行 89.36%。未覆盖的部分是入口与配置装配（`main.ts`、`cli-code.ts`、`pluginConfig.ts`、`runCli.ts`）和控制台 IO 适配器，它们由子进程端到端/宿主测试间接覆盖，其余为少数不会发生的防御性分支。
- **类型检查**：TypeScript `strict`，并开启 `noImplicitOverride`、`noUnusedLocals`、`noUnusedParameters`；`npm run typecheck` 无错误。
- **撤销的精确性**：每个可撤销命令都测试了"执行 → undo 后状态与执行前一致 → redo 回显与首次相同"；move / scale 专门用浮点坐标验证 undo 后原值逐位相同。
- **启动即失败**：命令名或语法缺失、同名多形式未声明 `accepts`、图形类型名缺失或重名、锚点不是坐标属性等程序缺陷，都在注册时直接抛出，不会留到运行时。
- **一致性自查**：每个需求完成后，用"关键词检索 + 逐条归类"复查按名分派与依赖方向（见上一节）。
- **过程约束**：决策点全部确认后才进入开发；git 历史按"文档 → 分步实现 → 测试 → 补齐文档"推进，每个需求在功能分支上开发后合并，没有 one-shot 大提交。

### 已知限制

- 根级容器不可 ungroup（按课程 §4.2）：画布根下 group 出来的容器只能通过 undo 解散。
- 读入外部文件时，不支持的元素被跳过、未知属性被丢弃，svg 根元素上的其他属性不保留，再次保存时这些内容会丢失；只有 viewBox 的文件保存后会带上明确的 width / height。
- `scale` 以坐标原点为中心，图形的位置会随之变化。
- 回显未做单复数处理（如 `1 children`）。
- 复合模型的私有部件目前只支持“根 + 直接叶子子元素”；若模型在 `toSvg` 中写出嵌套包装，读回时会成为普通文档节点，而不会还原为私有部件。
