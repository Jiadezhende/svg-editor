import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import { UndoRecord } from '../../src/backend';
import type { Receiver } from '../../src/backend';

export default class DeleteCommand extends EditCommand {
  static override readonly command = 'delete';
  static override readonly usage = 'delete <id>';
  private readonly undoRecord = new UndoRecord();
  private readonly id: string;

  constructor(private readonly receiver: Receiver, args: readonly string[]) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  undo(): CommandResult { return this.undoRecord.undo(); }

  execute(): CommandResult {
    const doc = this.receiver.document();
    return this.undoRecord.execute(doc.captureStructure(), () => {
      const node = doc.requireNode(this.id);
      const parent = node.parent();
      doc.remove(node);
      return {
        result: new CommandResult().line(`${node.value.label()} deleted`),
        undo: `${node.value.label()} restored into ${parent?.value.label() ?? 'svg'}`,
      };
    });
  }
}
