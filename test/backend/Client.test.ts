import { buildCommandTable } from '../../src/bootstrap';
import type { CommandForm } from '../../src/backend';
import { describe, expect, it } from 'vitest';
import Client from '../../src/backend/Client';
import Command from '../../src/backend/command/Command';
import CommandResult from '../../src/backend/command/CommandResult';
import EditorError from '../../src/backend/error/EditorError';
import StubCommand from '../support/StubCommand';

/** 第二个注册的命令，用于验证 help 的顺序。 */
class NoopCommand extends Command {
  static override readonly command = 'noop';
  static override readonly usage = 'noop <id>';
  execute(): CommandResult {
    return new CommandResult();
  }
}

class NamelessCommand extends Command {
  static override readonly usage = 'nameless';
  execute(): CommandResult {
    return new CommandResult();
  }
}

class UsagelessCommand extends Command {
  static override readonly command = 'usageless';
  execute(): CommandResult {
    return new CommandResult();
  }
}

class HelpCommand extends Command {
  static override readonly command = 'help';
  static override readonly usage = 'help';
  execute(): CommandResult {
    return new CommandResult();
  }
}

/** 同名两种形式：`pair` 与 `pair <a> <b>`。 */
class PairShowCommand extends Command {
  static override readonly command = 'pair';
  static override readonly usage = 'pair';
  static override accepts(args: readonly string[]): boolean {
    return args.length === 0;
  }
  execute(): CommandResult {
    return new CommandResult().line('show form');
  }
}

class PairSetCommand extends Command {
  static override readonly command = 'pair';
  static override readonly usage = 'pair <a> <b>';
  constructor(args: readonly string[]) {
    super();
    this.expectArgCount(args, 2);
  }
  static override accepts(args: readonly string[]): boolean {
    return args.length > 0;
  }
  execute(): CommandResult {
    return new CommandResult().line('set form');
  }
}

/** 与 PairShowCommand 范围重叠的形式。 */
class PairOverlapCommand extends Command {
  static override readonly command = 'pair';
  static override readonly usage = 'pair [x]';
  static override accepts(args: readonly string[]): boolean {
    return args.length <= 1;
  }
  execute(): CommandResult {
    return new CommandResult();
  }
}

/** 同名但未覆盖 accepts 的形式。 */
class PairDefaultCommand extends Command {
  static override readonly command = 'pair';
  static override readonly usage = 'pair <any…>';
  execute(): CommandResult {
    return new CommandResult();
  }
}

const stub: CommandForm = { definition: StubCommand, create: (args) => new StubCommand(args) };
const noop: CommandForm = { definition: NoopCommand, create: () => new NoopCommand() };
const pairShow: CommandForm = { definition: PairShowCommand, create: () => new PairShowCommand() };
const pairSet: CommandForm = { definition: PairSetCommand, create: (args) => new PairSetCommand(args) };

function createClient(...forms: readonly CommandForm[]): Client {
  return new Client(buildCommandTable(forms));
}

describe('Client 分派', () => {
  it('未知命令报错', () => {
    expect(() => createClient(stub, noop).execute(['foo'])).toThrow(new EditorError('unknown command: foo'));
  });

  it('ConcreteCommand 经构造解析参数后执行', () => {
    const result = createClient(stub, noop).execute(['stub', 'a', '2.50', 'warn']);
    expect(result.warnings()).toEqual(['stub a warned']);
    expect(result.lines()).toEqual(['a 2.5']);
  });

  it('参数格式错误在构造阶段报出', () => {
    expect(() => createClient(stub, noop).execute(['stub', 'a', 'x'])).toThrow('not a number: x');
    expect(() => createClient(stub, noop).execute(['stub'])).toThrow('usage: stub <name> <n> [warn]');
  });
});

describe('Client 内置命令', () => {
  it('help 先按注册顺序列出 ConcreteCommand，再列出内置命令', () => {
    expect(createClient(stub, noop).execute(['help']).lines()).toEqual([
      'stub <name> <n> [warn]',
      'noop <id>',
      'help',
      'undo',
      'redo',
      'exit',
      'quit',
    ]);
  });

  it.each(['exit', 'quit'])('%s 请求退出且不输出内容', (name) => {
    const client = createClient(stub, noop);
    expect(client.isExitRequested()).toBe(false);
    const result = client.execute([name]);
    expect(result.lines()).toEqual([]);
    expect(client.isExitRequested()).toBe(true);
  });

  it.each([
    ['undo', 'nothing to undo'],
    ['redo', 'nothing to redo'],
  ])('%s 交给 Invoker：历史为空时报错', (name, message) => {
    expect(() => createClient(stub, noop).execute([name])).toThrow(new EditorError(message));
  });

  it('内置命令带多余参数时报错并附语法', () => {
    const client = createClient(stub, noop);
    expect(() => client.execute(['help', 'x'])).toThrow('wrong number of arguments. usage: help');
    expect(() => client.execute(['exit', 'now'])).toThrow('usage: exit');
    expect(client.isExitRequested()).toBe(false);
  });
});

describe('Client 同名多形式', () => {
  function pairClient(): Client {
    return createClient(pairShow, pairSet);
  }

  it('按参数结构选出唯一接受的形式', () => {
    const client = pairClient();
    expect(client.execute(['pair']).lines()).toEqual(['show form']);
    expect(client.execute(['pair', '1', '2']).lines()).toEqual(['set form']);
  });

  it('选中形式后由其构造函数校验内容：个数不符时报该形式的语法', () => {
    expect(() => pairClient().execute(['pair', '1'])).toThrow(new EditorError('wrong number of arguments. usage: pair <a> <b>'));
  });

  it('注册顺序不影响选择', () => {
    const client = createClient(pairSet, pairShow);
    expect(client.execute(['pair']).lines()).toEqual(['show form']);
  });

  it('没有形式接受时报参数个数不符，列出全部语法', () => {
    class ExactPairSetCommand extends PairSetCommand {
      static override accepts(args: readonly string[]): boolean {
        return args.length === 2;
      }
    }
    const client = createClient(pairShow, {
      definition: ExactPairSetCommand,
      create: (args) => new ExactPairSetCommand(args),
    });
    expect(() => client.execute(['pair', '1'])).toThrow(
      new EditorError('wrong number of arguments. usage: pair | pair <a> <b>'),
    );
  });

  it('多个形式同时接受属于程序缺陷', () => {
    const client = createClient(pairShow, {
      definition: PairOverlapCommand,
      create: () => new PairOverlapCommand(),
    });
    expect(() => client.execute(['pair'])).toThrow('ambiguous forms of pair');
    expect(() => client.execute(['pair'])).not.toThrow(EditorError);
  });

  it('help 逐个列出各形式的语法', () => {
    expect(pairClient().execute(['help']).lines().slice(0, 2)).toEqual(['pair', 'pair <a> <b>']);
  });
});

describe('宿主命令表校验', () => {
  it('命令名或 usage 为空时启动即失败', () => {
    expect(() => buildCommandTable([{ definition: NamelessCommand, create: () => new NamelessCommand() }]))
      .toThrow('NamelessCommand must declare static command and usage');
    expect(() => buildCommandTable([{ definition: UsagelessCommand, create: () => new UsagelessCommand() }]))
      .toThrow('UsagelessCommand must declare static command and usage');
  });

  it('与内置命令重名时失败', () => {
    expect(() => buildCommandTable([{ definition: HelpCommand, create: () => new HelpCommand() }]))
      .toThrow('duplicate registration: commands/help');
  });

  it('重复注册同一个类时失败', () => {
    expect(() => buildCommandTable([stub, stub])).toThrow('duplicate command: stub');
  });

  it('同名多形式中有形式未覆盖 accepts 时失败', () => {
    expect(() => buildCommandTable([pairShow, { definition: PairDefaultCommand, create: () => new PairDefaultCommand() }]))
      .toThrow('command pair has multiple forms; each must override static accepts');
  });
});
