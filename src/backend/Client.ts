import CommandResult from './CommandResult';
import EditorError from './EditorError';
import type Command from './command/Command';
import Invoker from './invoker/Invoker';

/** 可注册的 ConcreteCommand 类：静态部分即定义，构造函数即工厂。 */
type ConcreteCommandClass = Pick<typeof Command, 'command' | 'usage'> &
  (new (args: readonly string[]) => Command);

/** 内置命令：操作会话自身（命令表、历史、生命周期），不经过 Invoker。 */
interface BuiltinEntry {
  readonly usage: string;
  readonly run: () => CommandResult;
}

/**
 * 后端唯一入口，Command 模式中的 Client。
 * 按命令名查表分派：先内置命令，再 ConcreteCommand；创建 ConcreteCommand 后交给 Invoker 执行。
 *
 * 待重构：按名分派是课程允许的两处之一（命令分发），见 doc/update/20261016_FEAT_CLI_REPL.md。
 */
export default class Client {
  private readonly invoker = new Invoker();
  private readonly builtins = new Map<string, BuiltinEntry>();
  private readonly commands = new Map<string, ConcreteCommandClass>();
  private exitRequested = false;

  constructor() {
    this.builtins.set('help', { usage: 'help', run: () => this.help() });
    this.builtins.set('undo', { usage: 'undo', run: () => this.undo() });
    this.builtins.set('redo', { usage: 'redo', run: () => this.redo() });
    this.builtins.set('exit', { usage: 'exit', run: () => this.exit() });
    this.builtins.set('quit', { usage: 'quit', run: () => this.exit() });
  }

  /** 注册 ConcreteCommand；定义缺失或重名属于程序缺陷，启动即失败。 */
  register(cls: ConcreteCommandClass): void {
    const { command, usage } = cls;
    if (!command || !usage) {
      throw new Error(`command class ${cls.name} must declare static command and usage`);
    }
    if (this.builtins.has(command) || this.commands.has(command)) {
      throw new Error(`duplicate command: ${command}`);
    }
    this.commands.set(command, cls);
  }

  /** 执行一条已分词的命令；失败时抛出 EditorError。 */
  execute(tokens: readonly string[]): CommandResult {
    const [name = '', ...args] = tokens;

    const builtin = this.builtins.get(name);
    if (builtin) {
      if (args.length > 0) {
        throw new EditorError(`wrong number of arguments. usage: ${builtin.usage}`);
      }
      return builtin.run();
    }

    const cls = this.commands.get(name);
    if (!cls) {
      throw new EditorError(`unknown command: ${name}`);
    }
    return this.invoker.execute(new cls(args));
  }

  isExitRequested(): boolean {
    return this.exitRequested;
  }

  private help(): CommandResult {
    const result = new CommandResult();
    for (const cls of this.commands.values()) {
      result.line(cls.usage);
    }
    for (const entry of this.builtins.values()) {
      result.line(entry.usage);
    }
    return result;
  }

  private undo(): CommandResult {
    throw new EditorError('command not implemented yet: undo');
  }

  private redo(): CommandResult {
    throw new EditorError('command not implemented yet: redo');
  }

  private exit(): CommandResult {
    this.exitRequested = true;
    return new CommandResult();
  }
}
