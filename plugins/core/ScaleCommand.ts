import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import { EditorError } from '../../src/backend';
import type { Shape } from '../../src/backend';
import type { ShapeMemento } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** `scale <id> <factor>`：以坐标原点为中心等比缩放位置与尺寸；容器递归到每个子孙；stroke-width 不缩放。 */
export default class ScaleCommand extends EditCommand {
  static override readonly command = 'scale';
  static override readonly usage = 'scale <id> <factor>';

  private readonly id: string;
  private readonly factor: number;
  /** 本次 execute 缩放的图形及缩放前的快照，供 undo 使用。 */
  private scaled: { shape: Shape; memento: ShapeMemento } | null = null;

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

  execute(): CommandResult {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    const memento = doc.capture(node);
    doc.scale(node, this.factor);
    const result = new CommandResult().line(`${shape.label()} scaled by ${this.formatNumber(this.factor)}`);
    this.scaled = { shape, memento };
    return result;
  }

  undo(): CommandResult {
    if (this.scaled === null) {
      throw new Error('undo before execute');
    }
    const { shape, memento } = this.scaled;
    memento.restore();
    return new CommandResult().line(`${shape.label()} scaled back by ${this.formatNumber(1 / this.factor)}`);
  }
}
