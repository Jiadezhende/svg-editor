import type CommandResult from '../command/CommandResult';
import type Command from '../command/Command';
import DocumentCommand from '../command/DocumentCommand';
import EditCommand from '../command/EditCommand';
import EditorError from '../error/EditorError';

/**
 * Command 模式中的 Invoker：执行命令，并维护撤销 / 重做历史。
 *
 * 命令执行成功后按类型分两支：编辑命令入撤销栈、清空重做栈并解禁；文档类命令清空历史并禁止 undo / redo；
 * 其余（显示类）不影响历史。执行失败时历史不变。
 */
export default class Invoker {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  /** 文档类命令之后为 true，直到下一次编辑命令成功执行。 */
  private sealed = false;

  execute(command: Command): CommandResult {
    const result = command.execute();
    if (command instanceof EditCommand) {
      this.undoStack.push(command);
      this.redoStack.length = 0;
      this.sealed = false;
    } else if (command instanceof DocumentCommand) {
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.sealed = true;
    }
    return result;
  }

  /** 撤销最近一个编辑命令，返回其撤销回显。 */
  undo(): CommandResult {
    if (this.sealed) {
      throw new EditorError('undo not allowed after io command');
    }
    const command = this.undoStack.pop();
    if (command === undefined) {
      throw new EditorError('nothing to undo');
    }
    const result = command.undo();
    this.redoStack.push(command);
    return result;
  }

  /** 重做最近撤销的命令：再次执行它，回显与原命令执行时相同。 */
  redo(): CommandResult {
    if (this.sealed) {
      throw new EditorError('redo not allowed after io command');
    }
    const command = this.redoStack.pop();
    if (command === undefined) {
      throw new EditorError('nothing to redo');
    }
    const result = command.execute();
    this.undoStack.push(command);
    return result;
  }
}
