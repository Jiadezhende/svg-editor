# CLI 插件

`npm run cli -- --config plugins.config.json` 按配置顺序装配插件。配置的 `plugins` 数组列出模块，`enabled: false` 跳过对应项，`options` 对象会传给插件。相对路径从配置文件所在目录解析，包名使用 Node ESM 解析。包目录通过 `package.json` 的 `main` 指定入口。

```json
{
  "name": "hello",
  "type": "module",
  "main": "./index.ts",
  "contributes": { "commands": ["hello"] }
}
```

插件入口默认导出一个同步函数，接收选项并返回分类后的贡献。模型映射与对应的图形类一起放进 `shapes`。

```ts
import { Command, CommandResult } from '../../src/backend';
import type { ActivatePlugin } from '../../src/backend';

class Hello extends Command {
  static override readonly command = 'hello';
  static override readonly usage = 'hello';
  execute(): CommandResult { return new CommandResult().line('hello'); }
}

const activate: ActivatePlugin = () => ({
  shapes: [], commands: [Hello], attributes: [], decorators: [],
});
export default activate;
```

`contributes` 支持 `shapes`、`commands`、`attributes`、`decorators`，名称分别来自 `type`、`command`、`handlerName`、`decoratorName`。命令的多个互斥形式在清单中只写一次。宿主核对清单与实际贡献并校验候选会话，任一环节失败即丢弃整包，后续插件继续装配。

代码装配的入口为 `npm run cli:code`。它静态引用插件，并将清单和函数交给宿主现有的 `registerPlugin`。需要直接提供贡献数组时，该方法也接受已构建的贡献对象。插件通过 `src/backend` 访问公开契约。
