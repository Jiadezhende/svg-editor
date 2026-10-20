import CommandResult from './command/CommandResult';
import EditorError from './error/EditorError';
import Command from './command/Command';
import Invoker from './invoker/Invoker';
import Workspace from './receiver/workspace/Workspace';

/** 可注册的 ConcreteCommand 类：静态部分即定义，构造函数即工厂。 */
type ConcreteCommandClass = Pick<typeof Command, 'command' | 'usage' | 'accepts'> &
  (new (workspace: Workspace, args: readonly string[]) => Command);

/** 内置命令：操作会话自身（命令表、历史、生命周期），不经过 Invoker。 */
interface BuiltinEntry {
  readonly usage: string;
  readonly run: () => CommandResult;
}

/**
 * 后端唯一入口，Command 模式中的 Client。
 * 按命令名查表分派：先内置命令，再 ConcreteCommand；同名多形式时按 `accepts` 唯一命中选择形式。
 * 创建 ConcreteCommand 时交给它 Receiver（Workspace），再交给 Invoker 执行。
 *
 * 待重构：按名分派是课程允许的两处之一（命令分发），见 doc/update/20261016_FEAT_CLI_REPL.md。
 */
export default class Client {
  private readonly invoker = new Invoker();
  private readonly workspace = new Workspace();
  private readonly builtins = new Map<string, BuiltinEntry>();
  /** 命令名 → 该名下的全部形式（顺序不影响选择）。 */
  private readonly commands = new Map<string, ConcreteCommandClass[]>();
  private exitRequested = false;

  constructor() {
    this.builtins.set('help', { usage: 'help', run: () => this.help() });
    this.builtins.set('undo', { usage: 'undo', run: () => this.undo() });
    this.builtins.set('redo', { usage: 'redo', run: () => this.redo() });
    this.builtins.set('exit', { usage: 'exit', run: () => this.exit() });
    this.builtins.set('quit', { usage: 'quit', run: () => this.exit() });
  }

  /**
   * 注册 ConcreteCommand；以下情况属于程序缺陷，启动即失败：
   * 定义缺失、与内置命令重名、重复注册同一个类、同名多形式中有形式未覆盖 `accepts`。
   */
  register(cls: ConcreteCommandClass): void {
    const { command, usage } = cls;
    if (!command || !usage) {
      throw new Error(`command class ${cls.name} must declare static command and usage`);
    }
    const forms = this.commands.get(command) ?? [];
    if (this.builtins.has(command) || forms.includes(cls)) {
      throw new Error(`duplicate command: ${command}`);
    }
    const next = [...forms, cls];
    if (next.length > 1 && next.some((form) => form.accepts === Command.accepts)) {
      throw new Error(`command ${command} has multiple forms; each must override static accepts`);
    }
    this.commands.set(command, next);
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

    const forms = this.commands.get(name);
    if (!forms) {
      throw new EditorError(`unknown command: ${name}`);
    }
    const cls = this.select(name, forms, args);
    return this.invoker.execute(new cls(this.workspace, args));
  }

  isExitRequested(): boolean {
    return this.exitRequested;
  }

  /** 在同名的形式中选出唯一接受 args 的那个；没有时报参数个数不符并列出全部语法，多于一个属于程序缺陷。 */
  private select(name: string, forms: readonly ConcreteCommandClass[], args: readonly string[]): ConcreteCommandClass {
    const matched = forms.filter((form) => form.accepts(args));
    if (matched.length === 0) {
      throw new EditorError(`wrong number of arguments. usage: ${forms.map((form) => form.usage).join(' | ')}`);
    }
    if (matched.length > 1) {
      throw new Error(`ambiguous forms of ${name}: ${matched.map((form) => form.name).join(', ')}`);
    }
    return matched[0];
  }

  private help(): CommandResult {
    const result = new CommandResult();
    for (const forms of this.commands.values()) {
      for (const cls of forms) {
        result.line(cls.usage);
      }
    }
    for (const entry of this.builtins.values()) {
      result.line(entry.usage);
    }
    return result;
  }

  private undo(): CommandResult {
    return this.invoker.undo();
  }

  private redo(): CommandResult {
    return this.invoker.redo();
  }

  private exit(): CommandResult {
    this.exitRequested = true;
    return new CommandResult();
  }
}
