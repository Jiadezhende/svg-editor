import Command from './Command';
import type CommandResult from './CommandResult';

/**
 * 可撤销的编辑命令。
 *
 * redo 即再次调用 `execute()`，为此子类须遵守：`execute` 时按 id 解析目标，`undo` 只使用本次 `execute` 记录的引用。
 * `undo` 只在 `execute` 成功之后调用，把文档恢复到 `execute` 之前的状态。
 * 撤销记录在操作及结果计算成功后保存；失败恢复由模型规则或用例所需的局部快照负责。
 * 执行框架只在操作成功后更新历史，不提供整份会话的通用回滚。
 */
export default abstract class EditCommand extends Command {
  abstract undo(): CommandResult;
}
