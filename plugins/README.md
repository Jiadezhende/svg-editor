# 自动发现插件

应用启动时自动发现本目录直接子包，按目录名升序装配全部插件，不使用配置文件、白名单或启用开关。随应用分发的 shapes 包提供六种图形，commands 包提供 17 个命令形式；它们和其他包采用完全相同的加载路径。空目录只提供 help、undo、redo、exit、quit 框架入口，不提供隐式基础能力。不扫描 node_modules；安装的包可复制或链接到这里。非包目录和普通文件不参与发现。

每个子包包含 package.json，例如 plugins/hello/package.json：

```json
{
  "name": "hello",
  "type": "module",
  "main": "index.ts",
  "contributes": { "commands": ["hello"] }
}
```

入口具名导出 activate(context) 函数；支持同步或异步激活。TypeScript 入口由当前 CLI 的 tsx 运行环境加载：

```ts
import { Command, CommandResult } from '../../src/backend';
import type { ExtensionContext } from '../../src/backend';

class HelloCommand extends Command {
  static override readonly command = 'hello';
  static override readonly usage = 'hello';
  execute(): CommandResult { return new CommandResult().line('hello'); }
}

export function activate(context: ExtensionContext): void {
  context.registerCommand(HelloCommand);
}
```

contributes 可声明 shapes、commands、attributes、decorators，未提供的类别视为空列表。名称分别对应模型 type、命令 command、静态 Handler 的 handlerName、装饰器类的 decoratorName。命令的多个形式可共用一个 command 名称并由 accepts 区分。声明须与实际注册的名称集合一致。

上下文仅开放 registerShape(model, mapping?)、registerCommand、registerAttributeHandler、registerTreeDecorator。Shape 附属的 SVG 映射与模型一起暂存，不提供当前 Workspace 或可写注册表。装饰器按包和包内注册顺序包装，Handler 同样按此顺序首次匹配。

单插件入口缺失、模块/依赖加载失败、缺少有效的具名 activate 导出、声明不一致、重复名称或激活异常会输出 error 并跳过该包；保留已成功插件并继续启动。失败包的全部暂存贡献与映射均不进入会话。激活返回后上下文关闭，不能延迟注册；插件不得依赖激活过程的外部副作用回滚。

代码装配可使用宿主的 assemblePlugins，同样经过暂存、校验和装配路径；空列表表示没有贡献。指定发现目录只加载该目录，没有 defaults 兜底。它属于宿主 API，插件实现本身只依赖 src/backend 公共入口。正式业务插件及双配置装配交付不在本次架构调整中。

## 领域 Handler 的接入位置

包名不限制贡献类别，业务包可在同一 activate 中 registerShape(Model, mapping) 和 registerAttributeHandler(Attributes)。contributes 同时声明 shapes 和 attributes。无需建立独立 Handler 包，也不为普通属性重复定义处理器。

SetCommand（commands 包）通过 Workspace.attributeHandlerRegistry().resolve(shape, key) 选择处理器；首个命中调用 apply/display，无命中才调用 Shape 默认属性规则。匹配逻辑及别名只在 Handler 中维护。部分修改或展示失败恢复模型快照，一次 set 仍为一个撤销单元。

commands 按目录名先于 shapes 注册是允许的：activate 只注册命令类，具体图形在用户执行创建或读入用例时才通过工厂查询。普通插件不得注册 help、undo、redo、exit、quit，它们由 Client 管理。
