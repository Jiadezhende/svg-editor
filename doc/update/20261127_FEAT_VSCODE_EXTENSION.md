# FEAT：VS Code SVG 文件标记与原生大纲

- 提案时间：2026-11-27
- 完成时间：2026-11-27（代码、测试、构建和 GUI 截图完成；总纲的最终发布项仍待整体验收）
- 类型：FEAT
- 关联 prd：doc/prd/phase2/20261125_VSCODE_EVIDENCE.md

## 动因

Phase 2 第一部分要求在同一仓库中交付一个 VS Code 扩展：Explorer 对 `.svg` 文件显示 `[]`，原生 Outline 展示 SVG 元素层级并支持源码定位、编辑更新和不完整 XML 容错。该扩展不是 CLI 插件，不能依赖 CLI 的 `src/` 或 `plugins/`，因此需要单独建包、单独构建和单独测试。

## 决策记录

| 议题 | 选项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 包边界 | 放进 CLI 包 / 独立顶层包 | `vscode-extension/` 独立包 | 扩展运行在 VS Code 宿主，和 CLI 的 Node 进程、依赖、构建和指标都不同 |
| 与 CLI 的依赖 | 复用 `SvgReader` / 零依赖 | 零运行时依赖 | `SvgReader` 使用 DOM，不保留源码位置，且构建领域 `Document`；Outline 需要 offset/range 和容错语法树 |
| 解析器 | 第三方 XML 解析 / 自写容错扫描器 | `SvgSourceParser` 自写扫描器 | 只解析元素结构和 id，无运行时依赖；非法/不完整输入返回空结果，符合“允许暂时清空大纲” |
| 文件标记 | 改写文件 / 宿主展示附加信息 | `FileDecorationProvider` 返回 `[]` | 不修改文件名或内容；目录通过 `workspace.fs.stat` 排除 |
| 大纲注册 | `contributes` 静态声明 / 运行时注册 | `activate` 中注册 `DocumentSymbolProvider` | 原生 Outline 使用运行时 provider；不引入自定义视图 |
| 激活时机 | 打开 SVG 时 / 启动后 | `onStartupFinished` | Explorer 标记需要在打开文件前就注册，不能只依赖 `onLanguage:svg` |
| 测试方式 | Electron 集成测试 / 单元测试 + 测试替身 | Vitest + `vscode` 替身 | provider 适配层薄；解析、名称、范围、标记判定都能在无宿主环境稳定测试 |
| 源码交付 | 打包源码 / 打包 `out` | `tsc` 输出 `out/`，VSIX 排除源码和测试 | VS Code 加载 CommonJS 入口；源码保留在仓库，不进入扩展包 |
| 指标 | 混入 CLI 报告 / 单独报告 | `vscode-extension/scripts/vscode-metrics.mjs` 单独输出 | 任务要求 VS Code 扩展单独列出，不能计入 CLI 增量 |

## 数据模型

- `SvgElementNode`
  - `tag: string`
  - `id: string | null`
  - `start/nameStart/nameEnd/end: number`：源码 offset，交给 `TextDocument.positionAt` 转成 VS Code 位置。
  - `children: readonly SvgElementNode[]`
  - `name(): string`：`tag` 或 `tag#id`。
- `SvgSourceParser.parse(text)` 返回元素根数组；不生成 CLI 的 `Shape`、`Document` 或 `ShapeView`。
- `SvgFileDecorationProvider` 只返回 `FileDecoration`；`SvgDocumentSymbolProvider` 只返回 `DocumentSymbol[]`。

## 架构 / 流程设计

```text
VS Code 工作台
├─ Explorer 请求资源装饰
│   └─ SvgFileDecorationProvider.provideFileDecoration(uri)
│       ├─ SvgPath.isSvg(uri.path)
│       └─ workspace.fs.stat(uri) → 文件类型
│           └─ FileDecoration('[]')
└─ SVG 文本打开/编辑
    └─ SvgDocumentSymbolProvider.provideDocumentSymbols(document)
        ├─ document.getText()
        ├─ SvgSourceParser.parse(text)
        │   └─ SvgElementNode[]（offset + children）
        └─ document.positionAt(offset)
            └─ DocumentSymbol[]（range + selectionRange）
```

`extension.ts` 只负责注册两个 provider；VS Code 在资源显示或文档变化时按需回调，扩展不轮询文件系统或文档。

文件装饰与经典 Decorator 的差别：

- CLI 的 `TreeDecorator` 是经典 Decorator：装饰器和被包装渲染器实现同一接口，持有内层对象，先委托再追加标签，顺序由装配链决定。
- VS Code 的 `FileDecorationProvider` 不是包装树节点：扩展向宿主注册回调，宿主调用后把返回的 `FileDecoration` 合并到 Explorer 条目。扩展不控制渲染，也不持有 `TreeItem`。
- 因而本实现更接近 Adapter/Provider：`SvgFileDecorationProvider` 把路径判断和文件类型适配到 VS Code 的 `FileDecorationProvider` 接口；`SvgDocumentSymbolProvider` 把 `SvgElementNode` 语法树适配成 `DocumentSymbol`。相同点是“附加展示信息”，不同点是控制反转、数据返回和异步调用。

Phase 1 复用评估：

| 模块 | 是否复用 | 原因 |
| --- | --- | --- |
| `SvgReader` / `@xmldom/xmldom` | 否 | DOM 不保留源码 offset；Reader 还构建 `Document`、校验模型并执行读入降级，超出大纲范围 |
| `Shape` / `Document` / `ShapeView` | 否 | 领域模型隐藏内部部件，不保存语法位置；Outline 需要只读语法节点 |
| `src/frontend/Tokenizer` | 否 | 它是 CLI 命令参数分词，不是 XML 解析 |
| `TreeRenderer` | 否 | 输出 CLI 文本树，不是 `DocumentSymbol`；只复用“递归遍历”的概念 |
| TypeScript / Vitest 基础设施 | 是 | 同仓库沿用语言和测试工具，但不共享运行时代码 |

## 测试与验证

| 用例 | 验证方式 | 结果 |
| --- | --- | --- |
| 嵌套 `svg/g/rect` 的层级、名称和 offset | `SvgSourceParser.test.ts` | 通过 |
| 无 id 的 `text` 显示标签名 | `SvgSourceParser.test.ts`、`SvgDocumentSymbolProvider.test.ts` | 通过 |
| 自闭合、注释、CDATA、DOCTYPE、引号内 `>` | `SvgSourceParser.test.ts` | 通过 |
| XML 实体 id | `SvgSourceParser.test.ts` | 通过 |
| 编辑后重新解析 | `SvgSourceParser.test.ts`、`SvgDocumentSymbolProvider.test.ts` | 通过 |
| 空文本、不完整 XML、错配标签、取消请求 | parser/provider 测试 | 通过 |
| `.svg` 文件标记、目录排除、普通文件排除、stat 失败 | `SvgFileDecorationProvider.test.ts` | 通过 |
| 两个 provider 注册及 subscriptions | `ExtensionActivation.test.ts` | 通过 |
| 扩展不引用 CLI、CLI 不引用 vscode | `Boundary.test.ts` | 通过 |
| 真实 Explorer 标记与 Outline 展示 | VS Code 1.148.0 扩展开发宿主，手工验收 | 通过，截图见 `vscode-extension/docs/evidence/screenshots/` |

自动化结果：5 个测试文件、16 项测试通过；`npm run typecheck` 通过；`npm run build` 生成 `out/extension.js`。GUI 证据、测试与指标索引见 [VS Code 验收](../../vscode-extension/docs/acceptance.md)。

## 遗留问题

- 总纲中的整体发布项仍待整体验收：最终候选、远程接入证明和 `p2` tag 不在本扩展提案范围内。
- VS Code 指标当前为工作区 `WORKTREE` 预览；最终提交确定后用 `npm run metrics` 按 `HEAD` 重新生成。
