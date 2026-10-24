# SVG 文件读写

- 时间：2026-10-16
- 所属阶段：phase1

## 需求背景

`save` 输出的文件应能直接在浏览器中打开；`read` 能读回同一格式，也能读入外部 SVG 文件。外部文件可能缺少 id，需要自动补全以满足"图形一律用 id 定位"的约定。参考：refs/phase_1.md §0、§2（自动补 id）、§3（read、save）、§4.2、§6。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 外部文件含不支持的元素（path、polygon、defs、style 等） | A：打印警告并跳过，不计入元素数；B：作为不透明节点保留，原样写回 | A | 本阶段只要求 6 种内置类型；A 会在 save 时丢失这些元素，记为已知限制 |
| 已支持元素上的未知属性（transform、text-anchor、font-size、class、style 等） | A：原样保留并在 save 时写回，不在 tree / show 中显示、不可 set、不参与 move / scale 计算；B：丢弃 | B | read 的定位是读回本编辑器保存的文件与简单的外部文件，课程要求不涉及未知属性；丢弃使图形模型与写出保持简单。代价：读入带 transform、class 等属性的文件后再保存，这些属性丢失，记为已知限制 |
| 文件内 id 重复 | A：拒绝读入，当前文档不变；B：后出现者重命名并警告 | A | id 唯一是全局约定 |
| `save <path>` 后无参 save 保存到哪 | A：`save <path>` 成功后该路径成为当前路径；B：始终保存到读入时的路径 | A | 符合"另存为"习惯 |
| svg 根缺少 width / height | A：取 viewBox 的尺寸，都没有时用 800×600；B：画布尺寸可不声明，save 时也不写出 | A | 外部文件常见情况（SVG 规范中三者均可选）；phase1 的画布按参考文档为数值尺寸，B 需改动文档生命周期与显示。代价：只有 viewBox 的文件读入再保存后带上明确的 width / height，由"随容器缩放"变为固定尺寸，记为已知限制 |
| read 覆盖已有文档是否提示 | A：打印 warning 后覆盖；B：直接覆盖 | A | 与 init 一致：覆盖会丢弃未保存的内容，至少要提示 |
| 文件内 id 不符合合法字符规则（`[A-Za-z_][A-Za-z0-9_.-]*`） | A：拒绝读入，当前文档不变；B：重新分配 id 并警告；C：原样接受 | A | 与 id 重复的处理一致 |

## 职责边界

- 负责：`read`、`save`、SVG 序列化与解析、缺 id 自动补全。
- 不负责：`box` 的 `data-kind` 读回还原（后续插件化阶段）；文档类命令后的 undo / redo 禁止规则（归属撤销与重做，本需求只声明 read / save 属于文档类命令）。

## Cases 处理策略

| 场景 | 输入 / 前置状态 | 预期行为 / 输出 |
| --- | --- | --- |
| 正常 | 文档含 bg、title、markers{c1, box}，`save demo.svg` | `saved to demo.svg (5 elements)` |
| 正常 | save 产物 | 浏览器打开渲染正确；read 读回后 tree 与保存前一致 |
| 正常 | 读入下方示例 `other.svg` | 先输出 `warning: assigned id rect1 to unnamed <rect>`，再输出 `read other.svg (7 elements)`；tree 与下方示例一致 |
| 正常 | read 后无参 `save` | 保存到读入时的路径 |
| 边界 | 已有文档，`read` 成功 | 先输出一行 `warning: …`（提示旧文档被丢弃），再输出读入结果 |
| 边界 | 自动补 id 与文件中已有 id 冲突 | 跳过已占用的编号（如已有 `rect1` 则分配 `rect2`） |
| 边界 | text 内容含中文或 `<`、`&` | 正确转义，读回不乱码 |
| 边界 | 空容器 | 输出为自闭合 `<g id="scene"/>` |
| 异常 | 文件不存在 / 不可读 | `error: cannot read file: a.svg`，当前文档不变 |
| 异常 | 文件不可写 | `error: cannot write file: a.svg` |
| 异常 | 文件内容非法（XML 解析失败、根不是 svg、几何属性不是数字、id 不符合合法字符规则） | 报错，当前文档不变 |
| 异常 | 文档来自 init（无路径）时无参 `save` | 报错，提示指定文件名 |

## 接口契约

| 命令 | 语法 | 类别 | 输出 |
| --- | --- | --- | --- |
| save | `save [file.svg]` | 文档类 | `saved to <file> (<n> elements)` |
| read | `read <file.svg>` | 文档类 | `read <file> (<n> elements)` |

- 元素数：全部图形元素（含 g），不含 svg 根
- 自动补 id：`<标签名><序号>`，同一标签序号从 1 起递增；每补一个输出一行 `warning: assigned id <id> to unnamed <<标签名>>`
- 文件格式：UTF-8；XML 声明 + `<svg xmlns width height viewBox>` + 2 空格缩进的嵌套元素；text 内容为子文本；示例：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <g id="flow">
    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>
    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>
    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>
  </g>
</svg>
```

**读入示例**：`other.svg`（第一个 rect 缺 id）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>
```

```text
svg> read other.svg
warning: assigned id rect1 to unnamed <rect>
read other.svg (7 elements)
svg> tree
svg (400x300)
├── rect#rect1  x=0 y=0 width=400 height=300
├── text#t1  x=10 y=290 text="imported"
├── circle#c1  cx=50 cy=50 r=10
├── g#g1
│   ├── rect#r2  x=0 y=0 width=10 height=10
│   └── circle#c2  cx=5 cy=5 r=2
└── ellipse#e1  cx=1 cy=2 rx=3 ry=4
```
