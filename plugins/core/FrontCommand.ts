import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import { UndoRecord } from '../../src/backend';
import type { Workspace } from '../../src/backend';

/** `front <id>`：节点迁移用例，由 Document 维护结构约束。 */
export default class FrontCommand extends EditCommand {
  static override readonly command = 'front';
  static override readonly usage = 'front <id>';
  private readonly undoRecord = new UndoRecord();
  private readonly id: string;

  constructor(private readonly workspace: Workspace, args: readonly string[]) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    return this.undoRecord.execute(doc.captureStructure(), () => {
      const node = doc.requireNode(this.id);
      const target = node.parent();
      const parent = node.parent();
      doc.relocate(node, target);
      return {
        result: new CommandResult().line(`${node.value.label()} brought to front`),
        undo: `${node.value.label()} restored into ${parent?.value.label() ?? 'svg'}`,
      };
    });
  }

  undo(): CommandResult { return this.undoRecord.undo(); }
}
