# 自动发现插件

应用启动时自动发现本目录的直接子包，按目录名升序装配。`core/` 提供六种基础图形和 17 个命令形式。`extensions/` 用于业务扩展，目前的清单为空。新增业务扩展时，将默认导出贡献类的文件放进 `extensions/` 根目录，并在它的清单中登记相应名称。

宿主按包暂存并校验贡献。没有插件包时，CLI 仅提供 `help`、`undo`、`redo`、`exit`、`quit` 五个框架入口。安装的包可复制或链接到本目录。

每个子包通过 `package.json` 声明 `name` 和 `contributes`。宿主统一扫描包根目录的默认导出，`main` 字段不参与发现。

```json
{
  "name": "hello",
  "type": "module",
  "contributes": { "commands": ["hello"] }
}
```

扫描模式只读取包根目录的 `.ts`、`.mts`、`.js`、`.mjs` 文件，按文件名升序处理，并跳过 `index.*`、`*.d.ts` 和 `*.test.*`。一个文件贡献一个默认导出类，推荐一类一文件：

```ts
import { Command, CommandResult } from '../../src/backend';

export default class HelloCommand extends Command {
  static override readonly command = 'hello';
  static override readonly usage = 'hello';
  execute(): CommandResult { return new CommandResult().line('hello'); }
}
```

`contributes` 可声明 shapes、commands、attributes、decorators，未提供的类别视为空列表。名称分别对应模型 type、命令 command、静态 Handler 的 handlerName、装饰器类的 decoratorName。命令的多个形式可共用一个 command 名称并由 accepts 区分。声明须与实际注册的名称集合一致；不一致会拒绝整个包。

扫描模式下，默认导出按类型实现识别：继承 Shape 的是模型，继承 Command 的是命令，继承 TreeDecorator 的是装饰器，带 handlerName、matches、apply、display 静态成员的是 Handler。普通图形不需要任何 SVG 写出代码；业务复合图形如果内部部件不是文档节点，可以在同一模块用 named export `mapping` 提供 `SvgShapeMapping`，扫描器会随默认导出的 Shape 一起注册：

```ts
import { Shape } from '../../src/backend';
import type { SvgShapeMapping } from '../../src/backend';

export default class Box extends Shape {
  static override readonly type = 'box';
}

export const mapping: SvgShapeMapping = {
  matches: (shape) => shape.type() === 'box',
  write: (shape) => ({ type: 'g', attributes: [['id', shape.id()], ['data-kind', 'box']] }),
};
```

上下文仅开放 registerShape(model, mapping?)、registerCommand、registerAttributeHandler、registerTreeDecorator。Shape 附属的 SVG 映射与模型一起暂存，不提供当前 Workspace 或可写注册表。自动发现按包目录名和包内文件名确定装饰器包装与 Handler 匹配顺序。

扫描文件缺少有效默认导出、模块或依赖加载失败、声明不一致或名称重复时，宿主报告错误，跳过该包并继续加载。扫描生成的装配入口返回后，注册上下文随即关闭。

CLI 通过 `createDiscoveredHost` 发现插件。指定发现目录时，宿主只加载该目录下的包。插件实现通过 `src/backend` 公共入口使用领域和注册契约。

仓库测试可以通过 `test/support/Plugins.ts` 中的 `assemblePlugins` 直接传入插件对象。这个辅助函数调用与 CLI 相同的 `assembleSources`，检查清单并装配插件。

## 领域 Handler 的接入位置

业务包可以在两个文件中分别默认导出 Shape 和 Handler，并在 `contributes` 中同时声明 `shapes` 和 `attributes`。

`core` 包的 SetCommand 通过 Workspace.attributeHandlerRegistry().resolve(shape, key) 选择处理器；首个命中调用 apply/display，无命中才调用 Shape 默认属性规则。匹配逻辑及别名只在 Handler 中维护。部分修改或展示失败恢复模型快照，一次 set 仍为一个撤销单元。

命令在用户执行创建或读入用例时通过工厂查询图形类型。`help`、`undo`、`redo`、`exit`、`quit` 由 Client 提供。
