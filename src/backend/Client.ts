import CommandResult from './command/CommandResult';
import EditorError from './error/EditorError';
import type Command from './command/Command';
import Invoker from './invoker/Invoker';
import EditCommand from './command/EditCommand';
import DocumentCommand from './command/DocumentCommand';
import type { TreeSuccess } from './receiver/tree/TreeLineRenderer';

type CommandDefinition = Pick<typeof Command, 'command' | 'usage' | 'accepts'> & { readonly name: string };
type CommandFactory = (args: readonly string[]) => Command;
type SuccessListener = (kind: TreeSuccess['kind']) => readonly string[];

export interface CommandForm {
  readonly definition: CommandDefinition;
  readonly create: CommandFactory;
}

export type CommandTable = ReadonlyMap<string, readonly CommandForm[]>;
export type CommandSession = Pick<Client, 'execute' | 'isExitRequested'>;

export const frameworkCommandNames = Object.freeze(['help', 'undo', 'redo', 'exit', 'quit'] as const);

/**
 * CLI 会话的命令分发入口。
 * 按命令名查表分派：先内置命令，再 ConcreteCommand；同名多形式时按 `accepts` 唯一命中选择形式。
 * 宿主提供已装配的命令表，Client 将工厂创建的命令交给 Invoker。
 */
export default class Client {
  private readonly invoker = new Invoker();
  private readonly builtins: ReadonlyMap<string, () => CommandResult>;
  private exitRequested = false;

  constructor(
    private readonly commands: CommandTable,
    private readonly onSuccess: SuccessListener = () => [],
  ) {
    const run: Record<typeof frameworkCommandNames[number], () => CommandResult> = {
      help: () => this.help(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      exit: () => this.exit(),
      quit: () => this.exit(),
    };
    this.builtins = new Map(frameworkCommandNames.map((name) => [name, run[name]]));
  }

  /** 执行一条已分词的命令；失败时抛出 EditorError。 */
  execute(tokens: readonly string[]): CommandResult {
    const [name = '', ...args] = tokens;

    const builtin = this.builtins.get(name);
    if (builtin) {
      if (args.length > 0) {
        throw new EditorError(`wrong number of arguments. usage: ${name}`);
      }
      return builtin();
    }

    const forms = this.commands.get(name);
    if (!forms) {
      throw new EditorError(`unknown command: ${name}`);
    }
    const form = this.select(name, forms, args);
    const command = form.create(args);
    const kind = command instanceof EditCommand ? 'edit' : command instanceof DocumentCommand ? command.successKind() : null;
    const result = this.invoker.execute(command);
    return kind === null ? result : this.notify(result, kind);
  }

  isExitRequested(): boolean {
    return this.exitRequested;
  }

  /** 在同名的形式中选出唯一接受 args 的那个；没有时报参数个数不符并列出全部语法，多于一个属于程序缺陷。 */
  private select(name: string, forms: readonly CommandForm[], args: readonly string[]): CommandForm {
    const matched = forms.filter((form) => form.definition.accepts(args));
    if (matched.length === 0) {
      throw new EditorError(`wrong number of arguments. usage: ${forms.map((form) => form.definition.usage).join(' | ')}`);
    }
    if (matched.length > 1) {
      throw new Error(`ambiguous forms of ${name}: ${matched.map((form) => form.definition.name).join(', ')}`);
    }
    return matched[0];
  }

  private help(): CommandResult {
    const result = new CommandResult();
    for (const forms of this.commands.values()) {
      for (const { definition } of forms) {
        result.line(definition.usage);
      }
    }
    for (const name of frameworkCommandNames) {
      result.line(name);
    }
    return result;
  }

  private undo(): CommandResult {
    return this.notify(this.invoker.undo(), 'undo');
  }

  private redo(): CommandResult {
    return this.notify(this.invoker.redo(), 'redo');
  }

  private notify(result: CommandResult, kind: TreeSuccess['kind']): CommandResult {
    for (const warning of this.onSuccess(kind)) result.warn(warning);
    return result;
  }

  private exit(): CommandResult {
    this.exitRequested = true;
    return new CommandResult();
  }
}
