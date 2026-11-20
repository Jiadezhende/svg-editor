import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import type { Shape } from '../../src/backend';
import type { ShapeMemento } from '../../src/backend';
import type { Workspace } from '../../src/backend';

/**
 * `move <id> <dx> <dy>`：增量平移；容器整体平移（递归到每个子孙）。
 * 有锚点的图形回显移动后的锚点 `moved to (x,y)`，没有锚点的（容器）回显偏移 `moved by (dx,dy)`。
 */
export default class MoveCommand extends EditCommand {
  static override readonly command = 'move';
  static override readonly usage = 'move <id> <dx> <dy>';

  private readonly id: string;
  private readonly dx: number;
  private readonly dy: number;
  /** 本次 execute 平移的图形及平移前的快照，供 undo 使用。 */
  private moved: { shape: Shape; memento: ShapeMemento } | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 3);
    this.id = args[0];
    this.dx = this.parseNumber(args[1]);
    this.dy = this.parseNumber(args[2]);
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    const memento = doc.capture(node);
    doc.move(node, this.dx, this.dy);
    const result = new CommandResult().line(this.describe(shape, 'moved', this.dx, this.dy));
    this.moved = { shape, memento };
    return result;
  }

  undo(): CommandResult {
    if (this.moved === null) {
      throw new Error('undo before execute');
    }
    const { shape, memento } = this.moved;
    memento.restore();
    return new CommandResult().line(this.describe(shape, 'moved back', -this.dx, -this.dy));
  }

  private describe(shape: Shape, verb: string, dx: number, dy: number): string {
    const position = shape.position();
    return position === null
      ? `${shape.label()} ${verb} by (${this.formatNumber(dx)},${this.formatNumber(dy)})`
      : `${shape.label()} ${verb} to (${position[0]},${position[1]})`;
  }
}
