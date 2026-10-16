import CommandResult from '../../src/backend/command/CommandResult';
import Command from '../../src/backend/command/Command';
import type Workspace from '../../src/backend/receiver/workspace/Workspace';

/**
 * 测试桩命令：`stub <name> <n> [warn]`。
 * 构造时校验个数并解析数字；执行时可产生一条警告，结果行回显名字与格式化后的数字；不访问 Receiver。
 */
export default class StubCommand extends Command {
  static override readonly command = 'stub';
  static override readonly usage = 'stub <name> <n> [warn]';

  private readonly label: string;
  private readonly value: number;
  private readonly warns: boolean;

  constructor(_workspace: Workspace, args: readonly string[]) {
    super();
    this.expectArgCount(args, 2, 3);
    this.label = args[0];
    this.value = this.parseNumber(args[1]);
    this.warns = args[2] === 'warn';
  }

  execute(): CommandResult {
    const result = new CommandResult();
    if (this.warns) {
      result.warn(`stub ${this.label} warned`);
    }
    return result.line(`${this.label} ${this.formatNumber(this.value)}`);
  }
}
