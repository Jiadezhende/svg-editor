import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import EditorError from '../../error/EditorError';
import type Shape from '../../receiver/document/shape/Shape';
import type ShapeMemento from '../../receiver/document/shape/ShapeMemento';
import type Workspace from '../../receiver/workspace/Workspace';

/** `scale <id> <factor>`：以坐标原点为中心等比缩放位置与尺寸；容器递归到每个子孙；stroke-width 不缩放。 */
export default class ScaleCommand extends EditCommand {
  static override readonly command = 'scale';
  static override readonly usage = 'scale <id> <factor>';

  private readonly id: string;
  private readonly factor: number;
  /** 本次 execute 缩放的图形及缩放前的快照，供 undo 使用。 */
  private scaled: { shape: Shape; memento: ShapeMemento } | null = null;

  constructor(
    private readonly workspace: Workspace,
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
    const shape = this.workspace.document().requireShape(this.id);
    const memento = shape.capture();
    shape.scale(this.factor);
    this.scaled = { shape, memento };
    return new CommandResult().line(`${shape.label()} scaled by ${this.formatNumber(this.factor)}`);
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
