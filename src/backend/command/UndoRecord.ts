import CommandResult from './CommandResult';

/** 局部编辑和撤销的组合助手，不管理会话或历史，不限定快照种类。 */
export default class UndoRecord {
  private saved: { restore(): void } | null = null;
  private text = '';

  execute(
    before: { restore(): void },
    action: () => { result: CommandResult; undo: string },
  ): CommandResult {
    try {
      const { result, undo } = action();
      this.saved = before;
      this.text = undo;
      return result;
    } catch (error) {
      before.restore();
      throw error;
    }
  }

  undo(): CommandResult {
    if (this.saved === null) throw new Error('undo before execute');
    this.saved.restore();
    return new CommandResult().line(this.text);
  }
}
