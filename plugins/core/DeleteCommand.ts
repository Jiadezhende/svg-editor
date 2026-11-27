import { CommandResult, EditCommand } from '../../src/backend';
import type { EditSnapshot, Receiver } from '../../src/backend';

export default class DeleteCommand extends EditCommand {
  static override readonly command = 'delete';
  static override readonly usage = 'delete <id>';

  private readonly id: string;

  constructor(private readonly receiver: Receiver, args: readonly string[]) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  protected snapshot(): EditSnapshot { return this.receiver.document().captureStructure(); }

  protected apply(): { result: CommandResult; undo: string } {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const parent = node.parent();
    doc.remove(node);
    return {
      result: new CommandResult().line(`${node.value.modelLabel()} deleted`),
      undo: `${node.value.modelLabel()} restored into ${parent?.value.modelLabel() ?? 'svg'}`,
    };
  }
}
