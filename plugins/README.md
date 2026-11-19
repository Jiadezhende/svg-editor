# 自动发现插件

应用启动时自动发现本目录直接子包，按目录名升序装配全部插件，不使用配置文件、白名单或启用开关。没有插件时保持基础 CLI 行为。不扫描 node_modules；安装的包可复制或链接到这里。非包目录和普通文件不参与发现。

每个子包包含 package.json，例如 plugins/hello/package.json：

```json
{
  "name": "hello",
  "type": "module",
  "main": "index.ts",
  "contributes": { "commands": ["hello"] }
}
```

入口默认导出提供 activate(context) 的对象或静态类；支持同步或异步激活。TypeScript 入口由当前 CLI 的 tsx 运行环境加载：

```ts
import { Command, CommandResult } from '../../src/backend';
import type { ExtensionContext } from '../../src/backend';

class HelloCommand extends Command {
  static override readonly command = 'hello';
  static override readonly usage = 'hello';
  execute(): CommandResult { return new CommandResult().line('hello'); }
}

export default {
  activate(context: ExtensionContext): void {
    context.registerCommand(HelloCommand);
  },
};
```

contributes 可声明 shapes、commands、attributes、decorators，未提供的类别视为空列表。名称分别对应模型 type、命令 command、静态 Handler 的 handlerName、装饰器类的 decoratorName。命令的多个形式可共用一个 command 名称并由 accepts 区分。声明须与实际注册的名称集合一致。

上下文仅开放 registerShape(model, mapping?)、registerCommand、registerAttributeHandler、registerTreeDecorator。Shape 附属的 SVG 映射与模型一起暂存，不提供当前 Workspace 或可写注册表。装饰器按包和包内注册顺序包装，Handler 同样按此顺序首次匹配。

单插件入口缺失、模块/依赖加载失败、无默认导出、声明不一致、重复名称或激活异常会输出 error 并跳过该包；保留已成功插件并继续启动。失败包的全部暂存贡献与映射均不进入会话。激活返回后上下文关闭，不能延迟注册；插件不得依赖激活过程的外部副作用回滚。

代码装配可使用宿主的 assemblePlugins，同样经过暂存、校验和装配路径。它属于宿主 API，插件实现本身只依赖 src/backend 公共入口。正式业务插件及双配置装配交付不在本次架构调整中。
