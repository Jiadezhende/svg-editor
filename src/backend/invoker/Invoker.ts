import type CommandResult from '../../common/CommandResult';
import type Command from '../command/Command';

/**
 * Command 模式中的 Invoker：只认抽象命令，负责执行。
 * undo / redo 栈与"io 命令后禁止撤销"的规则随撤销需求补入。
 */
export default class Invoker {
  execute(command: Command): CommandResult {
    return command.execute();
  }
}
