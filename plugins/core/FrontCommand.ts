import { CommandResult, EditCommand } from '../../src/backend';
import type { EditSnapshot, Receiver } from '../../src/backend';

/** `front <id>`：节点迁移用例，由 Document 维护结构约束。 */
export default class FrontCommand extends EditCommand {
  static override readonly command = 'front';
  static override readonly usage = 'front <id>';

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
    doc.relocate(node, parent);
    return {
      result: new CommandResult().line(`${node.value.modelLabel()} brought to front`),
      undo: `${node.value.modelLabel()} restored into ${parent?.value.modelLabel() ?? 'svg'}`,
    };
  }
}
