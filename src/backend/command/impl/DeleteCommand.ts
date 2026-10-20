import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import type Container from '../../receiver/document/Container';
import type Shape from '../../receiver/document/shape/Shape';
import type Workspace from '../../receiver/workspace/Workspace';

/** `delete <id>`：删除图形；容器连同全部子孙一起脱离文档。 */
export default class DeleteCommand extends EditCommand {
  static override readonly command = 'delete';
  static override readonly usage = 'delete <id>';

  private readonly id: string;
  /** 本次 execute 摘除的图形及其原父节点、原位置，供 undo 插回。 */
  private removed: { shape: Shape; parent: Container; index: number } | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const shape = this.workspace.document().requireShape(this.id);
    const parent = shape.parent();
    const index = parent.remove(shape);
    this.removed = { shape, parent, index };
    return new CommandResult().line(`${shape.label()} deleted`);
  }

  undo(): CommandResult {
    if (this.removed === null) {
      throw new Error('undo before execute');
    }
    const { shape, parent, index } = this.removed;
    parent.insert(shape, index);
    return new CommandResult().line(`${shape.label()} restored into ${parent.label()}`);
  }
}
