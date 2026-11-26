import { CommandResult, EditCommand, EditorError } from '../../src/backend';
import type { EditSnapshot, Receiver } from '../../src/backend';

/** `scale <id> <factor>`：以坐标原点为中心等比缩放位置与尺寸；容器递归到每个子孙；stroke-width 不缩放。 */
export default class ScaleCommand extends EditCommand {
  static override readonly command = 'scale';
  static override readonly usage = 'scale <id> <factor>';

  private readonly id: string;
  private readonly factor: number;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 2);
    this.id = args[0];
    this.factor = this.parseNumber(args[1]);
    if (!(this.factor > 0)) {
      throw new EditorError('scale factor must be positive');
    }
  }

  protected snapshot(): EditSnapshot {
    const doc = this.receiver.document();
    return doc.capture(doc.requireNode(this.id));
  }

  protected apply(): { result: CommandResult; undo: string } {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    doc.scale(node, this.factor);
    return {
      result: new CommandResult().line(`${shape.label()} scaled by ${this.formatNumber(this.factor)}`),
      undo: `${shape.label()} scaled back by ${this.formatNumber(1 / this.factor)}`,
    };
  }
}
