# CLI 源码指标

基线提交 `3f0f5a96ac3f6e1ea7438f7d3f893e76174d7c61`，目标提交 `f1e5274533f26e718f77b73a6caca95515eadcc8`。

统计 Git 提交中的 CLI 运行源码。内核含前端与 App，装配含入口和宿主，插件按源码路径归类。依赖、测试、文档、生成文件与 VS Code 扩展排除。

行数按物理行统计。圈复杂度按每个文件顶层和每个有函数体的可调用单元各计 1，再计入条件、循环、catch、非 default 的 case、三元表达式和短路逻辑表达式。历史上位于内核的内置实现按历史位置计入内核。

| 分类 | 文件基线 | 文件目标 | 行数基线 | 行数目标 | 行数增量 | 复杂度基线 | 复杂度目标 | 复杂度增量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 内核 | 58 | 44 | 2370 | 2003 | -367 | 483 | 517 | 34 |
| 装配 | 1 | 5 | 18 | 331 | 313 | 3 | 134 | 131 |
| 插件 | 0 | 24 | 0 | 829 | 829 | 0 | 147 | 147 |

## 文件与职责

| 路径 | 分类 | 职责 | 行数基线 → 目标 | 复杂度基线 → 目标 |
| --- | --- | --- | ---: | ---: |
| `plugins/core/AddtoCommand.ts` | 插件 | Phase 1 用例命令 | – → 36 | – → 6 |
| `plugins/core/BackCommand.ts` | 插件 | Phase 1 用例命令 | – → 34 | – → 6 |
| `plugins/core/CanvasResizeCommand.ts` | 插件 | Phase 1 用例命令 | – → 34 | – → 5 |
| `plugins/core/CanvasShowCommand.ts` | 插件 | Phase 1 用例命令 | – → 26 | – → 4 |
| `plugins/core/Circle.ts` | 插件 | 基础图形模型 | – → 10 | – → 1 |
| `plugins/core/CreateCommand.ts` | 插件 | Phase 1 用例命令 | – → 94 | – → 30 |
| `plugins/core/DeleteCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 6 |
| `plugins/core/Ellipse.ts` | 插件 | 基础图形模型 | – → 15 | – → 1 |
| `plugins/core/FrontCommand.ts` | 插件 | Phase 1 用例命令 | – → 34 | – → 6 |
| `plugins/core/Group.ts` | 插件 | 基础图形模型 | – → 10 | – → 2 |
| `plugins/core/GroupCommand.ts` | 插件 | Phase 1 用例命令 | – → 58 | – → 15 |
| `plugins/core/InitCommand.ts` | 插件 | Phase 1 用例命令 | – → 31 | – → 6 |
| `plugins/core/Line.ts` | 插件 | 基础图形模型 | – → 14 | – → 1 |
| `plugins/core/MoveCommand.ts` | 插件 | Phase 1 用例命令 | – → 58 | – → 7 |
| `plugins/core/ReadCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 5 |
| `plugins/core/Rect.ts` | 插件 | 基础图形模型 | – → 15 | – → 1 |
| `plugins/core/SaveCommand.ts` | 插件 | Phase 1 用例命令 | – → 27 | – → 5 |
| `plugins/core/ScaleCommand.ts` | 插件 | Phase 1 用例命令 | – → 50 | – → 6 |
| `plugins/core/SetCommand.ts` | 插件 | Phase 1 用例命令 | – → 59 | – → 10 |
| `plugins/core/ShowCommand.ts` | 插件 | Phase 1 用例命令 | – → 33 | – → 6 |
| `plugins/core/Text.ts` | 插件 | 基础图形模型 | – → 11 | – → 1 |
| `plugins/core/TreeCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 6 |
| `plugins/core/UngroupCommand.ts` | 插件 | Phase 1 用例命令 | – → 47 | – → 8 |
| `plugins/core/index.ts` | 插件 | 基础插件入口 | – → 37 | – → 3 |
| `src/App.ts` | 内核 | CLI 会话循环 | 45 → 39 | 8 → 8 |
| `src/backend/Client.ts` | 内核 | 公开契约与命令分派 | 121 → 116 | 34 → 32 |
| `src/backend/PluginContributions.ts` | 内核 | 公开契约与命令分派 | – → 23 | – → 1 |
| `src/backend/command/Command.ts` | 内核 | 命令契约与用例 | 54 → 54 | 8 → 8 |
| `src/backend/command/CommandResult.ts` | 内核 | 命令契约与用例 | 26 → 26 | 5 → 5 |
| `src/backend/command/DocumentCommand.ts` | 内核 | 命令契约与用例 | 7 → 10 | 1 → 2 |
| `src/backend/command/EditCommand.ts` | 内核 | 命令契约与用例 | 12 → 14 | 1 → 1 |
| `src/backend/command/RelocateCommand.ts` | 内核 | 命令契约与用例 | 50 → – | 5 → – |
| `src/backend/command/UndoRecord.ts` | 内核 | 命令契约与用例 | – → 28 | – → 5 |
| `src/backend/command/impl/AddtoCommand.ts` | 内核 | 命令契约与用例 | 35 → – | 6 → – |
| `src/backend/command/impl/BackCommand.ts` | 内核 | 命令契约与用例 | 24 → – | 4 → – |
| `src/backend/command/impl/CanvasResizeCommand.ts` | 内核 | 命令契约与用例 | 33 → – | 4 → – |
| `src/backend/command/impl/CanvasShowCommand.ts` | 内核 | 命令契约与用例 | 26 → – | 4 → – |
| `src/backend/command/impl/CreateCommand.ts` | 内核 | 命令契约与用例 | 99 → – | 23 → – |
| `src/backend/command/impl/DeleteCommand.ts` | 内核 | 命令契约与用例 | 41 → – | 5 → – |
| `src/backend/command/impl/FrontCommand.ts` | 内核 | 命令契约与用例 | 24 → – | 4 → – |
| `src/backend/command/impl/GroupCommand.ts` | 内核 | 命令契约与用例 | 72 → – | 16 → – |
| `src/backend/command/impl/InitCommand.ts` | 内核 | 命令契约与用例 | 31 → – | 6 → – |
| `src/backend/command/impl/MoveCommand.ts` | 内核 | 命令契约与用例 | 55 → – | 7 → – |
| `src/backend/command/impl/ReadCommand.ts` | 内核 | 命令契约与用例 | 34 → – | 5 → – |
| `src/backend/command/impl/SaveCommand.ts` | 内核 | 命令契约与用例 | 30 → – | 5 → – |
| `src/backend/command/impl/ScaleCommand.ts` | 内核 | 命令契约与用例 | 47 → – | 6 → – |
| `src/backend/command/impl/SetCommand.ts` | 内核 | 命令契约与用例 | 48 → – | 6 → – |
| `src/backend/command/impl/ShowCommand.ts` | 内核 | 命令契约与用例 | 29 → – | 4 → – |
| `src/backend/command/impl/TreeCommand.ts` | 内核 | 命令契约与用例 | 59 → – | 13 → – |
| `src/backend/command/impl/UngroupCommand.ts` | 内核 | 命令契约与用例 | 64 → – | 9 → – |
| `src/backend/error/EditorError.ts` | 内核 | 领域错误 | 10 → 10 | 2 → 2 |
| `src/backend/index.ts` | 内核 | 公开契约与命令分派 | – → 38 | – → 1 |
| `src/backend/invoker/Invoker.ts` | 内核 | 执行与历史 | 60 → 62 | 10 → 10 |
| `src/backend/receiver/Receiver.ts` | 内核 | 接收者与领域服务 | – → 89 | – → 16 |
| `src/backend/receiver/document/ChildList.ts` | 内核 | 接收者与领域服务 | 42 → – | 9 → – |
| `src/backend/receiver/document/Container.ts` | 内核 | 接收者与领域服务 | 16 → – | 1 → – |
| `src/backend/receiver/document/Document.ts` | 内核 | 接收者与领域服务 | 116 → 231 | 26 → 86 |
| `src/backend/receiver/document/DocumentStructureMemento.ts` | 内核 | 接收者与领域服务 | – → 8 | – → 3 |
| `src/backend/receiver/document/ShapeNode.ts` | 内核 | 接收者与领域服务 | – → 19 | – → 5 |
| `src/backend/receiver/document/attribute/AttributeSpec.ts` | 内核 | 接收者与领域服务 | 45 → – | 7 → – |
| `src/backend/receiver/document/attribute/CoordinateSpec.ts` | 内核 | 接收者与领域服务 | 24 → – | 6 → – |
| `src/backend/receiver/document/attribute/DecimalFormat.ts` | 内核 | 接收者与领域服务 | 26 → – | 7 → – |
| `src/backend/receiver/document/attribute/LengthSpec.ts` | 内核 | 接收者与领域服务 | 12 → – | 3 → – |
| `src/backend/receiver/document/attribute/NumericSpec.ts` | 内核 | 接收者与领域服务 | 27 → – | 6 → – |
| `src/backend/receiver/document/attribute/StringSpec.ts` | 内核 | 接收者与领域服务 | 16 → – | 4 → – |
| `src/backend/receiver/document/attribute/StrokeWidthSpec.ts` | 内核 | 接收者与领域服务 | 8 → – | 2 → – |
| `src/backend/receiver/document/attribute/TextSpec.ts` | 内核 | 接收者与领域服务 | 8 → – | 2 → – |
| `src/backend/receiver/document/shape/AttributeHandler.ts` | 内核 | 接收者与领域服务 | – → 15 | – → 1 |
| `src/backend/receiver/document/shape/AttributeHandlerRegistry.ts` | 内核 | 接收者与领域服务 | – → 30 | – → 13 |
| `src/backend/receiver/document/shape/Circle.ts` | 内核 | 接收者与领域服务 | 10 → – | 1 → – |
| `src/backend/receiver/document/shape/Ellipse.ts` | 内核 | 接收者与领域服务 | 15 → – | 1 → – |
| `src/backend/receiver/document/shape/Group.ts` | 内核 | 接收者与领域服务 | 54 → – | 14 → – |
| `src/backend/receiver/document/shape/Line.ts` | 内核 | 接收者与领域服务 | 14 → – | 1 → – |
| `src/backend/receiver/document/shape/Rect.ts` | 内核 | 接收者与领域服务 | 15 → – | 1 → – |
| `src/backend/receiver/document/shape/Shape.ts` | 内核 | 接收者与领域服务 | 227 → 302 | 57 → 78 |
| `src/backend/receiver/document/shape/ShapeFactory.ts` | 内核 | 接收者与领域服务 | 69 → 77 | 14 → 18 |
| `src/backend/receiver/document/shape/ShapeMemento.ts` | 内核 | 接收者与领域服务 | 18 → 18 | 6 → 6 |
| `src/backend/receiver/document/shape/ShapeView.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 1 |
| `src/backend/receiver/document/shape/Text.ts` | 内核 | 接收者与领域服务 | 11 → – | 1 → – |
| `src/backend/receiver/document/shape/attribute/AttributeSpec.ts` | 内核 | 接收者与领域服务 | – → 45 | – → 7 |
| `src/backend/receiver/document/shape/attribute/CoordinateSpec.ts` | 内核 | 接收者与领域服务 | – → 24 | – → 6 |
| `src/backend/receiver/document/shape/attribute/LengthSpec.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 3 |
| `src/backend/receiver/document/shape/attribute/NumericSpec.ts` | 内核 | 接收者与领域服务 | – → 34 | – → 9 |
| `src/backend/receiver/document/shape/attribute/StringSpec.ts` | 内核 | 接收者与领域服务 | – → 21 | – → 6 |
| `src/backend/receiver/document/shape/attribute/StrokeWidthSpec.ts` | 内核 | 接收者与领域服务 | – → 9 | – → 2 |
| `src/backend/receiver/document/shape/attribute/TextSpec.ts` | 内核 | 接收者与领域服务 | – → 8 | – → 2 |
| `src/backend/receiver/svg/SvgFile.ts` | 内核 | 接收者与领域服务 | 21 → 21 | 5 → 5 |
| `src/backend/receiver/svg/SvgReader.ts` | 内核 | 接收者与领域服务 | 138 → 162 | 43 → 56 |
| `src/backend/receiver/svg/SvgWriter.ts` | 内核 | 接收者与领域服务 | 65 → 122 | 16 → 39 |
| `src/backend/receiver/tree/BaseTreeLineRenderer.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 4 |
| `src/backend/receiver/tree/TreeDecorator.ts` | 内核 | 接收者与领域服务 | – → 21 | – → 6 |
| `src/backend/receiver/tree/TreeLineRenderer.ts` | 内核 | 接收者与领域服务 | – → 17 | – → 1 |
| `src/backend/receiver/tree/TreeRenderer.ts` | 内核 | 接收者与领域服务 | – → 63 | – → 22 |
| `src/backend/receiver/workspace/Workspace.ts` | 内核 | 接收者与领域服务 | 55 → – | 9 → – |
| `src/backend/utils/DecimalFormat.ts` | 内核 | 数值格式 | – → 26 | – → 7 |
| `src/bootstrap.ts` | 装配 | CLI 启动与宿主装配 | – → 183 | – → 79 |
| `src/cli-code.ts` | 装配 | CLI 启动与宿主装配 | – → 8 | – → 2 |
| `src/frontend/CommandReader.ts` | 内核 | 读行、分词与输出 | 53 → 53 | 12 → 12 |
| `src/frontend/ParseError.ts` | 内核 | 读行、分词与输出 | 10 → 10 | 2 → 2 |
| `src/frontend/ResultPrinter.ts` | 内核 | 读行、分词与输出 | 26 → 26 | 7 → 7 |
| `src/frontend/Tokenizer.ts` | 内核 | 读行、分词与输出 | 38 → 38 | 9 → 9 |
| `src/frontend/io/ConsoleInputSource.ts` | 内核 | 控制台输入输出适配 | 22 → 22 | 4 → 4 |
| `src/frontend/io/ConsoleOutputSink.ts` | 内核 | 控制台输入输出适配 | 14 → 14 | 4 → 4 |
| `src/frontend/io/InputSource.ts` | 内核 | 控制台输入输出适配 | 8 → 8 | 1 → 1 |
| `src/frontend/io/OutputSink.ts` | 内核 | 控制台输入输出适配 | 11 → 11 | 1 → 1 |
| `src/main.ts` | 装配 | CLI 启动与宿主装配 | 18 → 17 | 3 → 7 |
| `src/pluginConfig.ts` | 装配 | 配置与模块加载 | – → 106 | – → 44 |
| `src/runCli.ts` | 装配 | CLI 启动与宿主装配 | – → 17 | – → 2 |
