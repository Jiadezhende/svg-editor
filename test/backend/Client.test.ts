import { createWorkspace } from '../support/Plugins';
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
  constructor(_workspace: unknown, args: readonly string[]) {
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

async function createClient(): Promise<Client> {
  const client = new Client((await createWorkspace()));
  client.register(StubCommand);
  client.register(NoopCommand);
  return client;
}

describe('Client 分派', () => {
  it('未知命令报错', async () => {
    await expect(async () => (await createClient()).execute(['foo'])).rejects.toThrow(new EditorError('unknown command: foo'));
  });

  it('ConcreteCommand 经构造解析参数后执行', async () => {
    const result = (await createClient()).execute(['stub', 'a', '2.50', 'warn']);
    expect(result.warnings()).toEqual(['stub a warned']);
    expect(result.lines()).toEqual(['a 2.5']);
  });

  it('参数格式错误在构造阶段报出', async () => {
    await expect(async () => (await createClient()).execute(['stub', 'a', 'x'])).rejects.toThrow('not a number: x');
    await expect(async () => (await createClient()).execute(['stub'])).rejects.toThrow('usage: stub <name> <n> [warn]');
  });
});

describe('Client 内置命令', () => {
  it('help 先按注册顺序列出 ConcreteCommand，再列出内置命令', async () => {
    expect((await createClient()).execute(['help']).lines()).toEqual([
      'stub <name> <n> [warn]',
      'noop <id>',
      'help',
      'undo',
      'redo',
      'exit',
      'quit',
    ]);
  });

  it.each(['exit', 'quit'])('%s 请求退出且不输出内容', async (name) => {
    const client = (await createClient());
    expect(client.isExitRequested()).toBe(false);
    const result = client.execute([name]);
    expect(result.lines()).toEqual([]);
    expect(client.isExitRequested()).toBe(true);
  });

  it.each([
    ['undo', 'nothing to undo'],
    ['redo', 'nothing to redo'],
  ])('%s 交给 Invoker：历史为空时报错', async (name, message) => {
    await expect(async () => (await createClient()).execute([name])).rejects.toThrow(new EditorError(message));
  });

  it('内置命令带多余参数时报错并附语法', async () => {
    const client = (await createClient());
    expect(() => client.execute(['help', 'x'])).toThrow('wrong number of arguments. usage: help');
    expect(() => client.execute(['exit', 'now'])).toThrow('usage: exit');
    expect(client.isExitRequested()).toBe(false);
  });
});

describe('Client 同名多形式', () => {
  async function pairClient(): Promise<Client> {
    const client = new Client((await createWorkspace()));
    client.register(PairShowCommand);
    client.register(PairSetCommand);
    return client;
  }

  it('按参数结构选出唯一接受的形式', async () => {
    const client = (await pairClient());
    expect(client.execute(['pair']).lines()).toEqual(['show form']);
    expect(client.execute(['pair', '1', '2']).lines()).toEqual(['set form']);
  });

  it('选中形式后由其构造函数校验内容：个数不符时报该形式的语法', async () => {
    await expect(async () => (await pairClient()).execute(['pair', '1'])).rejects.toThrow(new EditorError('wrong number of arguments. usage: pair <a> <b>'));
  });

  it('注册顺序不影响选择', async () => {
    const client = new Client((await createWorkspace()));
    client.register(PairSetCommand);
    client.register(PairShowCommand);
    expect(client.execute(['pair']).lines()).toEqual(['show form']);
  });

  it('没有形式接受时报参数个数不符，列出全部语法', async () => {
    const client = new Client((await createWorkspace()));
    client.register(PairShowCommand);
    client.register(class extends PairSetCommand {
      static override accepts(args: readonly string[]): boolean {
        return args.length === 2;
      }
    });
    expect(() => client.execute(['pair', '1'])).toThrow(
      new EditorError('wrong number of arguments. usage: pair | pair <a> <b>'),
    );
  });

  it('多个形式同时接受属于程序缺陷', async () => {
    const client = new Client((await createWorkspace()));
    client.register(PairShowCommand);
    client.register(PairOverlapCommand);
    expect(() => client.execute(['pair'])).toThrow('ambiguous forms of pair');
    expect(() => client.execute(['pair'])).not.toThrow(EditorError);
  });

  it('help 逐个列出各形式的语法', async () => {
    expect((await pairClient()).execute(['help']).lines().slice(0, 2)).toEqual(['pair', 'pair <a> <b>']);
  });
});

describe('Client 注册校验', () => {
  it('命令名或 usage 为空时启动即失败', async () => {
    await expect(async () => new Client((await createWorkspace())).register(NamelessCommand)).rejects.toThrow('NamelessCommand must declare static command and usage');
    await expect(async () => new Client((await createWorkspace())).register(UsagelessCommand)).rejects.toThrow('UsagelessCommand must declare static command and usage');
  });

  it('与内置命令重名时失败', async () => {
    await expect(async () => new Client((await createWorkspace())).register(HelpCommand)).rejects.toThrow('duplicate command: help');
  });

  it('重复注册同一个类时失败', async () => {
    const client = (await createClient());
    expect(() => client.register(StubCommand)).toThrow('duplicate command: stub');
  });

  it('同名多形式中有形式未覆盖 accepts 时失败', async () => {
    const client = new Client((await createWorkspace()));
    client.register(PairShowCommand);
    expect(() => client.register(PairDefaultCommand)).toThrow('command pair has multiple forms; each must override static accepts');
  });
});
