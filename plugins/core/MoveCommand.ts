import { CommandResult, EditCommand } from '../../src/backend';
import type { EditSnapshot, Receiver, Shape } from '../../src/backend';

/**
 * `move <id> <dx> <dy>`：增量平移；容器整体平移（递归到每个子孙）。
 * 有锚点的图形回显移动后的锚点 `moved to (x,y)`，没有锚点的（容器）回显偏移 `moved by (dx,dy)`。
 * 快照覆盖整棵子树；失败由基类恢复，撤销回显使用移动前记录的锚点。
 */
export default class MoveCommand extends EditCommand {
  static override readonly command = 'move';
  static override readonly usage = 'move <id> <dx> <dy>';

  private readonly id: string;
  private readonly dx: number;
  private readonly dy: number;
  private original: readonly [string, string] | null = null;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 3);
    this.id = args[0];
    this.dx = this.parseNumber(args[1]);
    this.dy = this.parseNumber(args[2]);
  }

  protected snapshot(): EditSnapshot {
    const node = this.receiver.document().requireNode(this.id);
    this.original = node.value.position();
    return this.receiver.document().capture(node);
  }

  protected apply(): { result: CommandResult; undo: string } {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    doc.move(node, this.dx, this.dy);
    const undo = this.original === null
      ? `${shape.label()} moved back by (${this.formatNumber(-this.dx)},${this.formatNumber(-this.dy)})`
      : `${shape.label()} moved back to (${this.original[0]},${this.original[1]})`;
    return { result: new CommandResult().line(this.describe(shape, 'moved', this.dx, this.dy)), undo };
  }

  private describe(shape: Shape, verb: string, dx: number, dy: number): string {
    const position = shape.position();
    return position === null
      ? `${shape.label()} ${verb} by (${this.formatNumber(dx)},${this.formatNumber(dy)})`
      : `${shape.label()} ${verb} to (${position[0]},${position[1]})`;
  }
}
