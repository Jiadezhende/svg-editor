import { describe, expect, it } from 'vitest';
import Client from '../../src/backend/Client';
import Command from '../../src/backend/command/Command';
import PlaceholderCommand from '../../src/backend/command/PlaceholderCommand';
import CommandResult from '../../src/backend/command/CommandResult';
import EditorError from '../../src/backend/error/EditorError';
import StubCommand from '../support/StubCommand';

class PendingCommand extends PlaceholderCommand {
  static override readonly command = 'pending';
  static override readonly usage = 'pending <id>';
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

class HelpCommand extends PlaceholderCommand {
  static override readonly command = 'help';
  static override readonly usage = 'help';
}

function createClient(): Client {
  const client = new Client();
  client.register(StubCommand);
  client.register(PendingCommand);
  return client;
}

describe('Client 分派', () => {
  it('未知命令报错', () => {
    expect(() => createClient().execute(['foo'])).toThrow(new EditorError('unknown command: foo'));
  });

  it('ConcreteCommand 经构造解析参数后执行', () => {
    const result = createClient().execute(['stub', 'a', '2.50', 'warn']);
    expect(result.warnings()).toEqual(['stub a warned']);
    expect(result.lines()).toEqual(['a 2.5']);
  });

  it('参数格式错误在构造阶段报出', () => {
    expect(() => createClient().execute(['stub', 'a', 'x'])).toThrow('not a number: x');
    expect(() => createClient().execute(['stub'])).toThrow('usage: stub <name> <n> [warn]');
  });

  it('占位命令报"尚未实现"，与未知命令区分，且不校验参数', () => {
    const client = createClient();
    expect(() => client.execute(['pending', 'r1', '10', '0'])).toThrow('command not implemented yet: pending');
    expect(() => client.execute(['pending'])).toThrow('command not implemented yet: pending');
  });
});

describe('Client 内置命令', () => {
  it('help 先按注册顺序列出 ConcreteCommand，再列出内置命令', () => {
    expect(createClient().execute(['help']).lines()).toEqual([
      'stub <name> <n> [warn]',
      'pending <id>',
      'help',
      'undo',
      'redo',
      'exit',
      'quit',
    ]);
  });

  it.each(['exit', 'quit'])('%s 请求退出且不输出内容', (name) => {
    const client = createClient();
    expect(client.isExitRequested()).toBe(false);
    const result = client.execute([name]);
    expect(result.lines()).toEqual([]);
    expect(client.isExitRequested()).toBe(true);
  });

  it.each(['undo', 'redo'])('%s 本次占位，报"尚未实现"', (name) => {
    expect(() => createClient().execute([name])).toThrow(`command not implemented yet: ${name}`);
  });

  it('内置命令带多余参数时报错并附语法', () => {
    const client = createClient();
    expect(() => client.execute(['help', 'x'])).toThrow('wrong number of arguments. usage: help');
    expect(() => client.execute(['exit', 'now'])).toThrow('usage: exit');
    expect(client.isExitRequested()).toBe(false);
  });
});

describe('Client 注册校验', () => {
  it('命令名或 usage 为空时启动即失败', () => {
    expect(() => new Client().register(NamelessCommand)).toThrow('NamelessCommand must declare static command and usage');
    expect(() => new Client().register(UsagelessCommand)).toThrow('UsagelessCommand must declare static command and usage');
  });

  it('与内置命令重名时失败', () => {
    expect(() => new Client().register(HelpCommand)).toThrow('duplicate command: help');
  });

  it('与已注册命令重名时失败', () => {
    const client = createClient();
    expect(() => client.register(StubCommand)).toThrow('duplicate command: stub');
  });
});
