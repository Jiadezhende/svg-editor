# VS Code 扩展架构

本文件说明 `vscode-extension` 的包边界、对象职责、运行时调用和设计取舍。安装、运行、验收结果见 [`../README.md`](../README.md) 和 [`acceptance.md`](acceptance.md)。

## 1. 定位与边界

扩展是 Phase 2 第一部分的独立产品，负责两件事：

- 在 Explorer 中给 `.svg` 文件附加 `[]` 标记；
- 在 VS Code 原生 Outline 中展示 SVG 元素层级，并让节点定位到源码范围。

它不是 CLI 插件：不经过 `cli/plugins.config.json`，不注册 `ShapeProvider`/`Command`/`TreeDecorator`/`AttributeHandler`，也不引用 CLI 的 `src/` 或 `plugins/`。

| 维度 | CLI | VS Code 扩展 |
| --- | --- | --- |
| 源码根 | `cli/src`、`cli/plugins` | `vscode-extension/src` |
| 运行进程 | Node CLI | VS Code 扩展宿主 |
| 构建 | `tsx` / `tsc` | `tsc` 输出 CommonJS `out/` |
| 配置入口 | 插件清单与 `activate(options)` | `package.json` + VS Code `activate(context)` |
| 依赖方向 | 不 import `vscode` | 不 import `cli/src`、`cli/plugins` |

`Boundary.test.ts` 检查两条方向都不存在 import：扩展源码不出现 CLI 路径，CLI 源码不出现 `vscode`。这条约束让两个产品可以独立安装、构建、测试和计算指标。

## 2. 模块结构

```text
src/
├── extension.ts                         activate/deactivate 与 provider 注册
├── SvgPath.ts                           `.svg` 路径判断
├── decoration/
│   └── SvgFileDecorationProvider.ts      Explorer 标记适配器
└── outline/
    ├── SvgElementNode.ts                 Outline 语法节点
    ├── SvgSourceParser.ts                容错 SVG 源码扫描器
    └── SvgDocumentSymbolProvider.ts      DocumentSymbol 适配器
```

运行时没有第三方依赖；`vscode` 由扩展宿主提供，TypeScript 类型来自 `@types/vscode`。测试使用 `test/support/VSCodeApi.ts` 作为最小 API 替身，不启动 Electron。

## 3. 运行时流程

### 3.1 激活

```text
VS Code 启动
  → 读取 package.json 的 activationEvents: onStartupFinished
  → 调用 activate(context)
      → window.registerFileDecorationProvider(SvgFileDecorationProvider)
      → languages.registerDocumentSymbolProvider({ pattern: '**/*.svg' }, SvgDocumentSymbolProvider)
      → 两个 Disposable 进入 context.subscriptions
```

扩展不在 `activate` 中读取文件或文档；它只注册回调。之后由 VS Code 在需要时调用 provider。

### 3.2 文件标记

```text
Explorer 显示资源
  → SvgFileDecorationProvider.provideFileDecoration(uri)
      → SvgPath.isSvg(uri.path)
      → workspace.fs.stat(uri) 判断文件/目录
      → 文件返回 FileDecoration('[]')，其他返回 undefined
```

标记是 Explorer 的附加展示信息，不修改资源名、内容或文件系统。`provideFileDecoration` 是异步的；`stat` 失败时返回 `undefined`，不向宿主抛错。目录通过 `FileType.Directory` 排除，因此名为 `assets.svg` 的目录也不会被标记。

### 3.3 原生大纲

```text
SVG 文本打开/编辑
  → SvgDocumentSymbolProvider.provideDocumentSymbols(document)
      → document.getText()                      读取当前编辑文本，不读磁盘
      → SvgSourceParser.parse(text)             扫描元素结构和 offset
      → SvgElementNode[]                        只读语法树
      → document.positionAt(offset)             转成 VS Code Position
      → DocumentSymbol[]                        range + selectionRange + children
  → VS Code 原生 Outline 渲染和点击定位
```

`SvgSourceParser` 是纯解析器，不依赖 `vscode`；`SvgDocumentSymbolProvider` 是唯一把 offset 转成 VS Code 范围的适配层。`selectionRange` 指向起始标签名，`range` 覆盖整个元素，点击 Outline 节点时由 VS Code 使用该范围定位。

## 4. 关键对象

### 4.1 SvgSourceParser

只服务于大纲，不承担完整 SVG 解析：

- 扫描开始标签、结束标签、自闭合标签、注释、CDATA、处理指令和 DOCTYPE；
- 处理属性引号内的 `>`、基础 XML 实体和命名空间前缀；
- 记录元素的 `start`、标签名范围、`end` 和子节点；
- 不构建 CLI 的 `Shape`/`Document`，不校验属性值、几何或 SVG 语义；
- 未闭合标签、错配结束标签、未闭合引号/注释等不完整输入返回空数组，不抛出；
- 下一次合法输入重新解析，Outline 自动恢复。

### 4.2 SvgElementNode

不可变语法节点，保存 `tag`、`id`、源码 offset 和子节点。`name()` 返回 `tag` 或 `tag#id`，不包含领域类型、样式或文档关系。

### 4.3 SvgDocumentSymbolProvider

把 `SvgElementNode` 树适配为 `DocumentSymbol`：

- `document.positionAt()` 把 UTF-16 offset 转成 VS Code 行列；
- 有子元素的节点用 `SymbolKind.Module`，叶子用 `SymbolKind.Object`；
- 空文本、非法文本、取消请求返回 `[]`；
- parser 异常在 provider 边界转为空结果，避免影响扩展宿主。

### 4.4 SvgFileDecorationProvider

把“路径 + 文件类型”适配为 `FileDecoration`。文件类型读取通过构造函数注入，默认使用 `workspace.fs.stat`；测试可以注入替身，不需要真实文件系统。

## 5. 设计模式

### 5.1 Provider / Adapter

VS Code 的 `FileDecorationProvider` 和 `DocumentSymbolProvider` 是宿主定义的目标接口；扩展类实现它们，把内部数据适配成宿主需要的 `FileDecoration` / `DocumentSymbol`：

- `SvgFileDecorationProvider` 适配 `SvgPath` 与 `workspace.fs.stat`；
- `SvgDocumentSymbolProvider` 适配 `SvgSourceParser` / `SvgElementNode`；
- `SvgSourceParser` 与 `SvgElementNode` 不依赖 VS Code，可单独测试。

### 5.2 与经典 Decorator 的差异

CLI 的 `TreeDecorator` 是经典 Decorator：装饰器和被包装渲染器实现同一接口，持有内层对象，先委托渲染再追加标签，多个标签按装配顺序形成链。VS Code 的文件装饰不是这种结构：

- 扩展不包装 `TreeItem`，也不实现 Explorer 的渲染接口；
- 扩展向 VS Code 注册回调，宿主调用后把返回的 `FileDecoration` 合并到资源条目；
- 是否显示、如何布局、何时刷新由 VS Code 决定，属于控制反转；
- 返回的是数据（badge/tooltip），不是包装后的渲染结果；
- 调用是异步的，没有装饰链顺序。

相同点仅是“给已有展示附加信息”；实现机制、对象组合和调用方向都不同。

## 6. 与 Phase 1 的复用评估

| Phase 1 模块 | 是否复用 | 原因 |
| --- | --- | --- |
| `SvgReader` / `@xmldom/xmldom` | 否 | DOM 不保留源码 offset；Reader 还构建 `Document`、校验模型并执行读入降级 |
| `Shape` / `Document` / `ShapeView` | 否 | 领域模型隐藏内部部件，不保存语法位置；Outline 需要只读语法节点 |
| `frontend/Tokenizer` | 否 | 它是 CLI 命令参数分词，不是 XML 解析 |
| `TreeRenderer` | 否 | 输出 CLI 文本树，不是 `DocumentSymbol`；只复用“递归遍历”的概念 |
| TypeScript / Vitest 基础设施 | 是 | 同仓库沿用语言和测试工具，但不共享运行时代码 |

结论是解析、模型和遍历都不直接复用运行时代码。A.2 需要“源码文本 → 带 offset 的语法树 → `DocumentSymbol`”，与 CLI 的“SVG 文本 → 领域文档”目标不同；共享 `SvgReader` 会同时引入源码位置缺失和领域模型耦合。

## 7. 失败边界

| 场景 | 行为 |
| --- | --- |
| 非 `.svg` 路径 | 文件标记返回 `undefined` |
| 目录名为 `assets.svg` | `workspace.fs.stat` 识别为 Directory，不标记 |
| `stat` 失败 | 不标记，不抛错 |
| 空文本 / 不完整 XML | Outline 返回空数组，扩展继续运行 |
| 解析器意外异常 | provider 捕获并返回空数组 |
| 取消请求 | 返回空数组 |
| 编辑未保存 | 每次从 `document.getText()` 读取当前文本 |

不实现完整 XML/SVG 校验、图形预览或命名空间语义；这些不属于 A.1/A.2 的交付范围。
