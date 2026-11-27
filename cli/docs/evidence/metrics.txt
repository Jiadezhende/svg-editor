# CLI 源码指标

基线提交 `3f0f5a96ac3f6e1ea7438f7d3f893e76174d7c61`，目标提交 `5107f84ce547f0a29575f0e11ad0dab2ca982bbc`。

统计 Git 提交中的 CLI 运行源码。内核含前端与 App，装配含入口和宿主，插件按源码路径归类。依赖、测试、文档、生成文件与 VS Code 扩展排除。

行数按物理行统计。圈复杂度按每个文件顶层和每个有函数体的可调用单元各计 1，再计入条件、循环、catch、非 default 的 case、三元表达式和短路逻辑表达式。历史上位于内核的内置实现按历史位置计入内核。目录迁移到 `cli/` 前后的提交都按 CLI 根目录内的路径归并。

| 分类 | 文件基线 | 文件目标 | 行数基线 | 行数目标 | 行数增量 | 复杂度基线 | 复杂度目标 | 复杂度增量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 内核 | 58 | 43 | 2370 | 2056 | -314 | 483 | 531 | 48 |
| 装配 | 1 | 5 | 18 | 339 | 321 | 3 | 131 | 128 |
| 插件 | 0 | 30 | 0 | 1155 | 1155 | 0 | 237 | 237 |

## 文件与职责

| 路径 | 分类 | 职责 | 行数基线 → 目标 | 复杂度基线 → 目标 |
| --- | --- | --- | ---: | ---: |
| `plugins/box/Box.ts` | 插件 | 复合图形、属性、SVG 映射与树标签 | – → 121 | – → 35 |
| `plugins/box/index.ts` | 插件 | 复合图形、属性、SVG 映射与树标签 | – → 42 | – → 13 |
| `plugins/core/AddtoCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 5 |
| `plugins/core/BackCommand.ts` | 插件 | Phase 1 用例命令 | – → 29 | – → 5 |
| `plugins/core/CanvasResizeCommand.ts` | 插件 | Phase 1 用例命令 | – → 34 | – → 5 |
| `plugins/core/CanvasShowCommand.ts` | 插件 | Phase 1 用例命令 | – → 26 | – → 4 |
| `plugins/core/Circle.ts` | 插件 | 基础图形模型 | – → 21 | – → 3 |
| `plugins/core/CreateCommand.ts` | 插件 | Phase 1 用例命令 | – → 78 | – → 23 |
| `plugins/core/DeleteCommand.ts` | 插件 | Phase 1 用例命令 | – → 28 | – → 5 |
| `plugins/core/Ellipse.ts` | 插件 | 基础图形模型 | – → 27 | – → 3 |
| `plugins/core/FrontCommand.ts` | 插件 | Phase 1 用例命令 | – → 29 | – → 5 |
| `plugins/core/Group.ts` | 插件 | 基础图形模型 | – → 14 | – → 4 |
| `plugins/core/GroupCommand.ts` | 插件 | Phase 1 用例命令 | – → 52 | – → 14 |
| `plugins/core/InitCommand.ts` | 插件 | Phase 1 用例命令 | – → 31 | – → 6 |
| `plugins/core/Line.ts` | 插件 | 基础图形模型 | – → 28 | – → 3 |
| `plugins/core/MoveCommand.ts` | 插件 | Phase 1 用例命令 | – → 52 | – → 7 |
| `plugins/core/ReadCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 5 |
| `plugins/core/Rect.ts` | 插件 | 基础图形模型 | – → 27 | – → 3 |
| `plugins/core/SaveCommand.ts` | 插件 | Phase 1 用例命令 | – → 27 | – → 5 |
| `plugins/core/ScaleCommand.ts` | 插件 | Phase 1 用例命令 | – → 40 | – → 5 |
| `plugins/core/SetCommand.ts` | 插件 | Phase 1 用例命令 | – → 38 | – → 5 |
| `plugins/core/ShowCommand.ts` | 插件 | Phase 1 用例命令 | – → 54 | – → 12 |
| `plugins/core/Text.ts` | 插件 | 基础图形模型 | – → 22 | – → 3 |
| `plugins/core/TreeCommand.ts` | 插件 | Phase 1 用例命令 | – → 32 | – → 6 |
| `plugins/core/UngroupCommand.ts` | 插件 | Phase 1 用例命令 | – → 41 | – → 7 |
| `plugins/core/index.ts` | 插件 | 基础插件入口 | – → 37 | – → 2 |
| `plugins/dir/DirectoryAccess.ts` | 插件 | 目录命令与文件系统适配 | – → 24 | – → 5 |
| `plugins/dir/index.ts` | 插件 | 目录命令与文件系统适配 | – → 46 | – → 15 |
| `plugins/modified-star/index.ts` | 插件 | 保存基准与树标签 | – → 55 | – → 16 |
| `plugins/stats/index.ts` | 插件 | 图形统计命令 | – → 36 | – → 8 |
| `src/App.ts` | 内核 | CLI 会话循环 | 45 → 39 | 8 → 8 |
| `src/backend/Client.ts` | 内核 | 公开契约与命令分派 | 121 → 116 | 34 → 32 |
| `src/backend/PluginContributions.ts` | 内核 | 公开契约与命令分派 | – → 19 | – → 1 |
| `src/backend/command/Command.ts` | 内核 | 命令契约与用例 | 54 → 54 | 8 → 8 |
| `src/backend/command/CommandResult.ts` | 内核 | 命令契约与用例 | 26 → 26 | 5 → 5 |
| `src/backend/command/DocumentCommand.ts` | 内核 | 命令契约与用例 | 7 → 10 | 1 → 2 |
| `src/backend/command/EditCommand.ts` | 内核 | 命令契约与用例 | 12 → 44 | 1 → 5 |
| `src/backend/command/RelocateCommand.ts` | 内核 | 命令契约与用例 | 50 → – | 5 → – |
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
| `src/backend/index.ts` | 内核 | 公开契约与命令分派 | – → 36 | – → 1 |
| `src/backend/invoker/Invoker.ts` | 内核 | 执行与历史 | 60 → 62 | 10 → 10 |
| `src/backend/receiver/Receiver.ts` | 内核 | 接收者与领域服务 | – → 112 | – → 21 |
| `src/backend/receiver/document/ChildList.ts` | 内核 | 接收者与领域服务 | 42 → – | 9 → – |
| `src/backend/receiver/document/Container.ts` | 内核 | 接收者与领域服务 | 16 → – | 1 → – |
| `src/backend/receiver/document/Document.ts` | 内核 | 接收者与领域服务 | 116 → 220 | 26 → 83 |
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
| `src/backend/receiver/document/shape/Shape.ts` | 内核 | 接收者与领域服务 | 227 → 336 | 57 → 76 |
| `src/backend/receiver/document/shape/ShapeFactory.ts` | 内核 | 接收者与领域服务 | 69 → 69 | 14 → 14 |
| `src/backend/receiver/document/shape/ShapeMemento.ts` | 内核 | 接收者与领域服务 | 18 → 18 | 6 → 6 |
| `src/backend/receiver/document/shape/ShapeView.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 1 |
| `src/backend/receiver/document/shape/SvgElement.ts` | 内核 | 接收者与领域服务 | – → 7 | – → 1 |
| `src/backend/receiver/document/shape/Text.ts` | 内核 | 接收者与领域服务 | 11 → – | 1 → – |
| `src/backend/receiver/document/shape/attribute/Attribute.ts` | 内核 | 接收者与领域服务 | – → 46 | – → 7 |
| `src/backend/receiver/document/shape/attribute/LengthAttribute.ts` | 内核 | 接收者与领域服务 | – → 14 | – → 3 |
| `src/backend/receiver/document/shape/attribute/NumericAttribute.ts` | 内核 | 接收者与领域服务 | – → 37 | – → 10 |
| `src/backend/receiver/document/shape/attribute/StringAttribute.ts` | 内核 | 接收者与领域服务 | – → 25 | – → 7 |
| `src/backend/receiver/document/shape/attribute/StrokeWidthAttribute.ts` | 内核 | 接收者与领域服务 | – → 14 | – → 3 |
| `src/backend/receiver/document/shape/attribute/TextAttribute.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 3 |
| `src/backend/receiver/svg/SvgFile.ts` | 内核 | 接收者与领域服务 | 21 → 21 | 5 → 5 |
| `src/backend/receiver/svg/SvgReader.ts` | 内核 | 接收者与领域服务 | 138 → 178 | 43 → 65 |
| `src/backend/receiver/svg/SvgWriter.ts` | 内核 | 接收者与领域服务 | 65 → 123 | 16 → 50 |
| `src/backend/receiver/tree/BaseTreeLineRenderer.ts` | 内核 | 接收者与领域服务 | – → 13 | – → 4 |
| `src/backend/receiver/tree/TreeDecorator.ts` | 内核 | 接收者与领域服务 | – → 21 | – → 6 |
| `src/backend/receiver/tree/TreeLineRenderer.ts` | 内核 | 接收者与领域服务 | – → 17 | – → 1 |
| `src/backend/receiver/tree/TreeRenderer.ts` | 内核 | 接收者与领域服务 | – → 63 | – → 22 |
| `src/backend/receiver/workspace/Workspace.ts` | 内核 | 接收者与领域服务 | 55 → – | 9 → – |
| `src/backend/utils/DecimalFormat.ts` | 内核 | 数值格式 | – → 26 | – → 7 |
| `src/bootstrap.ts` | 装配 | CLI 启动与宿主装配 | – → 179 | – → 76 |
| `src/cli-code.ts` | 装配 | CLI 启动与宿主装配 | – → 20 | – → 2 |
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
