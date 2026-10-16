import CommandResult from '../../common/CommandResult';
import EditorError from '../../common/EditorError';
import Command from './Command';

/**
 * 占位命令：命令名与语法已完整注册，执行时报"尚未实现"。
 * 子类只声明静态 `command` / `usage`；替换为真实实现时改为直接继承 Command。
 * 全部命令替换完成后删除本类。
 */
export default abstract class PlaceholderCommand extends Command {
  /** 占位期间不解析参数。 */
  constructor(_args: readonly string[]) {
    super();
  }

  execute(): CommandResult {
    throw new EditorError(`command not implemented yet: ${this.definition().command}`);
  }
}
