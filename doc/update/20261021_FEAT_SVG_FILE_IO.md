# FEAT：SVG 文件读写

- 提案时间：2026-10-21
- 完成时间：YYYY-MM-DD（开发完成后填写）
- 类型：FEAT
- 关联 prd：doc/prd/phase1/20261016_SVG_FILE_IO.md

<!-- 提案阶段：动因、决策记录、数据模型、架构 / 流程设计，讨论确认后方可进入开发 -->

## 动因

本次实现 SVG_FILE_IO 需求：把 `read`、`save` 由占位替换为真实实现，两者都是文档类命令（继承 DocumentCommand）。全部命令至此均有真实实现，PlaceholderCommand 随之删除。

需要确定的是：

- XML 如何解析（Node 没有内置 XML 解析器）；
- 序列化与解析放在哪里，如何做到按图形类的声明通用处理，不按元素名或类型分支；
- text 的内容在 SVG 中是子文本而不是属性，这一差异由谁声明；
- 当前文件路径与文件系统访问由谁持有。

前置：图形树、属性表与 `value(name)`（SHAPE_CREATE_DELETE、DISPLAY）、ShapeFactory（"后续 read 按元素名复用"）、DocumentCommand（UNDO_REDO）。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| XML 解析 | A：引入依赖 `@xmldom/xmldom`（标准 DOM 接口），只在 SvgReader 内部使用；B：自写最小 XML 解析器；C：`fast-xml-parser` | A | XML 的实体、注释、CDATA、命名空间等细节交给成熟实现；DOM 接口（`getAttribute`、`childNodes`）与 SVG 的树形结构直接对应；依赖只出现在一个类中，可替换。B 代码量与出错面都大，且不是本课程的考察重点；C 输出普通对象，保持子元素顺序需要额外配置 |
| 序列化与解析的位置 | A：receiver/svg 包中的 SvgWriter / SvgReader 按图形类的声明通用处理：元素名即 `type`，属性取自属性表，容器经 `asContainer()` 递归；B：各图形类自己实现 `toXml()` / `fromXml()`；C：访问者 | A | 与 tree / show 的做法一致，叶子类仍然只有声明，插件类型声明完即可读写；B 让 6 个类各写一遍且把 XML 格式带进图形模型；C 每新增类型要改全部访问者 |
| text 内容（子文本）由谁声明 | A：图形类新增静态 `content`：写成子文本而非属性的那个属性名，默认 null，Text 为 `'text'`；SvgWriter / SvgReader 据此处理；B：SvgWriter / SvgReader 中判断是否为 text | A | B 是按类型分支；A 是声明，与 `params`、`paint`、`anchor` 同一种写法 |
| 数值写出格式 | A：沿用数值格式（最多 6 位小数，去掉末尾 0）；B：完整精度（如 `0.30000000000000004`） | A | 文件整洁，与 tree / show 一致；6 位小数对绘图精度足够。代价：极小的浮点误差在保存时被舍去 |
| 文件中缺少的必填属性（如 `<rect>` 无 `width`） | A：取 SVG 默认值：数值为 0，text 内容为空串；B：保持未设置 | A | 与浏览器渲染一致；后续 tree、move 回显的锚点等都假定必填属性存在 |
| width / height 的取值 | A：纯数字或 `px` 后缀视为数值，其他单位视为未声明；B：只认纯数字，解析不了即视为未声明，按已确认的规则由 viewBox 推出；C：只接受纯数字，否则拒绝读入 | B | read 的定位是读回本编辑器保存的文件与简单的外部文件，不为单位做特例；视为未声明而非拒绝，带单位的文件仍可读入 |
| 当前路径与文件访问 | A：Workspace 持有当前路径（init 置空，read / save 设置）与 SvgFile（基于 `node:fs`）；测试使用临时目录；B：为文件访问定义接口并注入内存实现 | A | 不改命令的统一构造签名；真实文件系统的测试更接近实际。B 多一层抽象，目前没有第二种实现 |

## 数据模型

| 位置 | 类 | 变更 | 职责 |
| --- | --- | --- | --- |
| backend/receiver/svg | `SvgWriter` | 新增 | Document → SVG 文本：XML 声明、`<svg xmlns width height viewBox>`、2 空格缩进；元素属性依次为 id、属性表中已设置的属性（`content` 除外）；`content` 写成子文本；无子节点的元素自闭合；转义 `& < > "` |
| backend/receiver/svg | `SvgReader` | 新增 | SVG 文本 → Document 与警告列表：校验根为 svg，推出画布尺寸与 viewBox；按元素名经 ShapeFactory 取图形类，不支持的元素警告并跳过（连同其子树）；已知属性经属性种类解析、校验，未知属性丢弃；缺 id 的按文档顺序补 `<标签名><序号>` 并警告；id 不合法或重复时报错 |
| backend/receiver/svg | `SvgFile` | 新增 | 文件读写（UTF-8）：失败时报 `cannot read file: <path>` / `cannot write file: <path>` |
| backend/receiver/workspace | `Workspace` | 修改 | 新增当前路径：`path()`（无路径时报错，提示指定文件名）、`replace(doc, path)`；新增 `files(): SvgFile` |
| backend/receiver/document | `Document` | 修改 | 构造时可指定 viewBox（read 用），默认仍为 `0 0 w h` |
| backend/receiver/document/shape | `Shape` | 修改 | 静态 `content`（默认 null）；新增 `entries()`：已设置属性的原值（属性表顺序，`content` 除外）、`content()`：`content` 属性的原值 |
| backend/receiver/document/shape | `Text` | 修改 | 声明 `content = 'text'` |
| backend/receiver/document/shape | `ShapeFactory` | 修改 | 新增 `find(type): ShapeClass \| null`，供 read 判断元素是否受支持（`lookup` 仍在未注册时报错） |
| backend/command/impl | `ReadCommand` | 占位 → 实现 | 继承 DocumentCommand；读文件 → 解析 → 替换当前文档并记下路径；覆盖已有文档时警告；回显 `read <file> (<n> elements)`；任何一步失败时当前文档不变 |
| backend/command/impl | `SaveCommand` | 占位 → 实现 | 继承 DocumentCommand；无参时保存到当前路径，带参时保存到该路径并使其成为当前路径；回显 `saved to <file> (<n> elements)` |
| backend/command | `PlaceholderCommand` | 删除 | 全部命令已有真实实现 |

## 架构 / 流程设计

模块划分与依赖规则不变：svg 包属于 receiver，依赖 document（图形树、ShapeFactory），命令经 Workspace 取得。本次新增 / 修改的文件：

```text
src/backend/
├── command/
│   ├── PlaceholderCommand.ts       删除
│   └── impl/
│       ├── ReadCommand.ts          占位 → 实现
│       └── SaveCommand.ts          占位 → 实现
└── receiver/
    ├── svg/
    │   ├── SvgReader.ts            新增（唯一使用 @xmldom/xmldom 的类）
    │   ├── SvgWriter.ts            新增
    │   └── SvgFile.ts              新增
    ├── workspace/Workspace.ts      当前路径、SvgFile
    └── document/
        ├── Document.ts             可指定 viewBox
        └── shape/
            ├── Shape.ts            content / entries
            ├── Text.ts             content = 'text'
            └── ShapeFactory.ts     find
```

### read 流程

```text
构造：参数恰好 1 个
执行：
  1. SvgFile 读取文本 → 失败报 cannot read file
  2. SvgReader 解析 → 新 Document + 警告列表；失败（XML 非法、根不是 svg、数值非法、id 不合法 / 重复）时报错
  3. workspace.replace(doc, path)；覆盖了已有文档时追加"旧文档被丢弃"的警告
  4. 回显 read <file> (<n> elements)，n = doc.shapes().length
  （1、2 失败时第 3 步不发生，当前文档不变；成功后由 Invoker 按文档类清空历史）
```

SvgReader 对每个元素：

```text
cls = factory.find(tagName)；为 null → 警告 skipped unsupported <tag>，跳过该元素及其子树
values = 对每个属性：cls.attribute(name) 存在 → spec.parse(text)；不存在且不是 id → 丢弃
cls.content 不为 null → 子文本作为该属性的值
缺少的必填属性取默认值（数值 0，文本空串）
shape = new cls(id 或临时占位, values)；容器 → 递归子元素
最后按文档顺序为缺 id 的图形分配 <tag><n>（跳过已占用的编号），逐个警告
```

### save 流程

```text
构造：参数 0 或 1 个
执行：取文档 → 目标路径（带参为该路径，否则 workspace.path()，无路径报错）
     → SvgWriter 序列化 → SvgFile 写入（失败报 cannot write file）→ 记下路径
     → 回显 saved to <file> (<n> elements)
```

### 变化点

| 变化点 | 预留 |
| --- | --- |
| 插件类型（box）的读写 | 声明 `type`、`params`、`content` 即可被读写；`data-kind` 读回还原随插件阶段落地 |
| 更换 XML 解析实现 | 只改 SvgReader |

### 本次不做

- 不支持的元素原样保留（已决策为跳过）、未知属性原样保留（已决策为丢弃）；
- svg 根元素上的其他属性（如 `version`、`xmlns:xlink`）不保留，save 时按固定格式写出根元素。

<!-- 开发阶段：补齐以下内容；上方已确认的决策不得改动 -->

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| | | |

## 遗留问题

- 
