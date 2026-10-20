import Command from './Command';
import type CommandResult from './CommandResult';

/**
 * 可撤销的编辑命令。
 *
 * redo 即再次调用 `execute()`，为此子类须遵守：`execute` 时按 id 解析目标，`undo` 只使用本次 `execute` 记录的引用。
 * `undo` 只在 `execute` 成功之后调用，把文档恢复到 `execute` 之前的状态。
 */
export default abstract class EditCommand extends Command {
  abstract undo(): CommandResult;
}
