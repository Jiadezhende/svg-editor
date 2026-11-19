import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import UndoRecord from '../UndoRecord';
import EditorError from '../../error/EditorError';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `ungroup <gid>`：解散容器，子图形按原顺序提升到其父级、占据容器原来的位置。
 * 根级容器（画布根的直接子节点）不可解散。
 */
export default class UngroupCommand extends EditCommand {
  static override readonly command = 'ungroup';
  static override readonly usage = 'ungroup <gid>';
  private readonly undoRecord = new UndoRecord();

  private readonly id: string;
  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  undo(): CommandResult { return this.undoRecord.undo(); }

  execute(): CommandResult {
    const doc = this.workspace.document();
    return this.undoRecord.execute(doc.captureStructure(), () => {
      doc.requireNode(this.id);
      const node = doc.requireChildTarget(this.id);
      const parent = doc.parent(node);
      if (parent === null) throw new EditorError(`cannot ungroup top-level container: ${this.id}`);
      doc.checkRemove(node);
      const index = doc.indexOf(node);
      const children = doc.children(node);
      for (const child of children) doc.checkRelocate(child, parent);
      children.forEach((child, i) => doc.relocate(child, parent, index + i));
      doc.remove(node);
      return {
        result: new CommandResult().line(`${node.value.label()} ungrouped, ${children.length} children moved to ${parent.value.label()}`),
        undo: `${node.value.label()} restored into ${parent.value.label()} with ${children.length} children`,
      };
    });
  }
}
