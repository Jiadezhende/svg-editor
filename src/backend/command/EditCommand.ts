import Command from './Command';
import CommandResult from './CommandResult';

/** 失败时恢复的位置；`ShapeMemento` 与 `DocumentStructureMemento` 都满足。 */
export interface EditSnapshot {
  restore(): void;
}

/**
 * 可撤销的编辑命令。
 *
 * 一次用户编辑构成一个 undo 单元。基类的 `execute` 先取快照，操作失败时恢复并抛出，
 * 成功后才保存快照与撤销回显；`undo` 由基类统一恢复。子类只声明恢复范围 `snapshot`
 * 与操作 `apply`，不实现 `execute` / `undo`；redo 再次调用 `execute`，同样经过快照与恢复。
 */
export default abstract class EditCommand extends Command {
  private before: EditSnapshot | null = null;
  private undoText = '';

  override execute(): CommandResult {
    const before = this.snapshot();
    try {
      const { result, undo } = this.apply();
      this.before = before;
      this.undoText = undo;
      return result;
    } catch (error) {
      before.restore();
      throw error;
    }
  }

  undo(): CommandResult {
    if (this.before === null) throw new Error('undo before execute');
    this.before.restore();
    return new CommandResult().line(this.undoText);
  }

  /** 本次编辑失败时要恢复的范围；在修改前调用。 */
  protected abstract snapshot(): EditSnapshot;

  /** 执行修改，返回回显与撤销回显。 */
  protected abstract apply(): { result: CommandResult; undo: string };
}
