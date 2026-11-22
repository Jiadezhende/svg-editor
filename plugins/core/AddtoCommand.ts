import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import { UndoRecord } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** `addto <gid> <id>`：节点迁移用例，由 Document 维护结构约束。 */
export default class AddtoCommand extends EditCommand {
  static override readonly command = 'addto';
  static override readonly usage = 'addto <gid> <id>';
  private readonly undoRecord = new UndoRecord();
  private readonly id: string;
  private readonly containerId: string;

  constructor(private readonly receiver: Receiver, args: readonly string[]) {
    super();
    this.expectArgCount(args, 2);
    this.id = args[1];
    this.containerId = args[0];
  }

  execute(): CommandResult {
    const doc = this.receiver.document();
    return this.undoRecord.execute(doc.captureStructure(), () => {
      const node = doc.requireNode(this.id);
      const target = doc.requireNode(this.containerId);
      const parent = node.parent();
      doc.relocate(node, target);
      return {
        result: new CommandResult().line(`${node.value.label()} added to ${target!.value.label()}`),
        undo: `${node.value.label()} restored into ${parent?.value.label() ?? 'svg'}`,
      };
    });
  }

  undo(): CommandResult { return this.undoRecord.undo(); }
}
