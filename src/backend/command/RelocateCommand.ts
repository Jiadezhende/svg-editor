import CommandResult from './CommandResult';
import EditCommand from './EditCommand';
import type Container from '../receiver/document/Container';
import type Document from '../receiver/document/Document';
import type Shape from '../receiver/document/shape/Shape';
import type Workspace from '../receiver/workspace/Workspace';

/** 移动的目标：父节点与位置（省略位置即追加到末尾）。 */
export type Destination = readonly [Container, number?];

/**
 * 把一个图形移到另一个位置的编辑命令（front、back、addto）：记下原父节点与位置，relocate 到目标；
 * 撤销时 relocate 回原处。子类只决定目标与回显。
 */
export default abstract class RelocateCommand extends EditCommand {
  /** 本次 execute 移动的图形及其原父节点、原位置，供 undo 使用。 */
  private before: { shape: Shape; parent: Container; index: number } | null = null;

  constructor(
    private readonly workspace: Workspace,
    private readonly id: string,
  ) {
    super();
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const shape = doc.requireShape(this.id);
    const [target, index] = this.destination(doc, shape);
    const parent = shape.parent();
    this.before = { shape, parent, index: parent.children().indexOf(shape) };
    shape.relocate(target, index);
    return new CommandResult().line(this.describe(shape));
  }

  undo(): CommandResult {
    if (this.before === null) {
      throw new Error('undo before execute');
    }
    const { shape, parent, index } = this.before;
    shape.relocate(parent, index);
    return new CommandResult().line(`${shape.label()} restored into ${parent.label()}`);
  }

  /** 移动的目标；不允许移动时报错。 */
  protected abstract destination(doc: Document, shape: Shape): Destination;

  /** 执行后的回显。 */
  protected abstract describe(shape: Shape): string;
}
