import EditCommand from './EditCommand';
import CommandResult from './CommandResult';
import type Document from '../receiver/document/Document';
import type DocumentStructureMemento from '../receiver/document/DocumentStructureMemento';

/** 一次结构用例整体提交、失败恢复、整体撤销；不保存模型属性。 */
export default abstract class StructureCommand extends EditCommand {
  private before: DocumentStructureMemento | null = null;
  private undoText = '';

  protected edit(doc: Document, action: () => { result: CommandResult; undo: string }): CommandResult {
    const before = doc.captureStructure();
    try {
      const { result, undo } = action();
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
}
