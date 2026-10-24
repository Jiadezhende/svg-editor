# SVG Editor

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

### 阶段规划

| 阶段 | 内容 |
| --- | --- |
| Phase 1 | CLI 编辑器内核：文档读写、六种内置图形（rect / circle / ellipse / line / text / g）、编辑命令、结构树显示、undo / redo |
| 后续阶段 | 插件化扩展，例如以 ShapeProvider 插件注册复合图形类型 `box`（带标题的矩形框），内核无需改动 |

## 一致性自查

### 按名分派

编码约束要求：按名字分派只允许出现在命令分发和图形工厂两处，并须标注为待重构。

项目中按名字选择行为的地方只有下面两处。两处都位于"文本 → 对象"的边界：用户输入的是文本，总要有一处把名字翻译成对象；翻译完成后，所有行为都由多态完成，不再查看名字。

"待重构"的含义：查表本身不改，要改的是表里的条目由谁登记。现在所有条目都写在内核代码里，新增一个类型就得改内核；以后应当由新类型自己登记进来，内核不用动。例如后续阶段新增 `box` 时，由 box 插件自己调用 `factory.register(Box)`，而不是去改 ShapeFactory。这对应课程中 phase1 允许暂缺的"插槽"。

| 位置 | 名字 → 对象 | 翻译之后 | 待重构：条目由谁登记 |
| --- | --- | --- | --- |
| `Client.execute`（[Client.ts](../src/backend/Client.ts)） | 命令名 → 内置命令 / ConcreteCommand 类；同名多形式（如 `canvas` 与 `canvas <w> <h>`）由各形式的 `accepts` 按参数结构唯一命中 | 命令对象自己解析参数、执行、撤销；Invoker 只认抽象 `Command` | 现状：`main.ts` 扫描 `command/impl/` 自动注册，新增内核命令不改 Client。待重构：内核之外的插件命令目前无法注册，需开放注册插槽 |
| `ShapeFactory.lookup`（[ShapeFactory.ts](../src/backend/receiver/document/shape/ShapeFactory.ts)） | 图形类型名 → 图形类（create 按类型参数、read 按元素名使用；read 用 `find` 查询，未注册时跳过） | 查找、删除、撤销，以及后续的平移、缩放、显示、序列化，都由 Shape / Group 的覆盖和属性种类的多态完成 | 现状：内置 6 类写死在工厂的构造函数中。待重构：插件阶段改为由 ShapeProvider 各自注册，工厂只负责查表 |

以下几处也比较了名字或字符，但都不是按名分派：

| 位置 | 内容 | 不属于按名分派的原因 |
| --- | --- | --- |
| `Shape.attribute(name)` | 按属性名在图形类声明的属性表中查找属性种类 | 查的是数据（属性表条目），不依据图形类型选择行为；取到的属性种类再以多态完成解析与校验 |
| `CreateCommand` | 识别 `in` 关键字 | 语法解析 |
| `Tokenizer` / `CommandReader` | 字符比较（引号、空行） | 词法处理 |
| `UngroupCommand` | `shape.parent() === doc` 判断根级容器 | 对象同一性比较，不判断类型、不比较名字 |
| `SvgReader` | 根元素须为 `svg`；跳过非元素节点（文本、注释） | 文件格式校验与 DOM 节点分类，不选择图形行为 |
| `SvgWriter` | `typeof value === 'number'` 决定属性原值的文本形式 | 属性值类型（number \| string）的收窄，不是按图形类型分派 |
| `CoordinateSpec.translate` | 按自身的轴取 dx 或 dy | 二选一取数据，平移行为本身不变；坐标与其他属性的行为差异由属性种类的多态承担 |
| `App` | 用 `instanceof` 区分可报告的错误与程序缺陷 | 错误分类，不选择业务行为 |

以下一处按类型（而非名字）选择行为，属于开发者决策（见 doc/update/20261020_FEAT_UNDO_REDO.md）：

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| `Invoker.execute`（[Invoker.ts](../src/backend/invoker/Invoker.ts)） | 用 `instanceof` 分两支：EditCommand 入撤销栈，DocumentCommand 清空历史并禁止 undo / redo | 行为只有两条分支，集中在 Invoker 一处；不是课程禁止的"到处 `switch(tag)`"。新增命令类别时需在此增加分支 |

自查方式：以 `switch`、与字符串字面量的比较、`Map.get`、`instanceof` 为关键词检索 `src/`，逐条归类。最近一次自查于 SVG_FILE_IO 完成时（2026-10-21），后续每个需求完成时复查。
