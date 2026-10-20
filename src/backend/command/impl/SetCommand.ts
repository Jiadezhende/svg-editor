import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import type Shape from '../../receiver/document/shape/Shape';
import type ShapeMemento from '../../receiver/document/shape/ShapeMemento';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `set <id> <attr> <value>`：设置该图形属性表内的属性；容器只有外观属性，写在容器自身。
 * 属性能否设置、取值如何解析取决于图形类型，所以全部在执行时校验。
 */
export default class SetCommand extends EditCommand {
  static override readonly command = 'set';
  static override readonly usage = 'set <id> <attr> <value>';

  private readonly id: string;
  private readonly attribute: string;
  private readonly token: string;
  /** 本次 execute 设置的图形、设置前的快照与旧值的展示文本（原本未设置时为 null），供 undo 使用。 */
  private updated: { shape: Shape; memento: ShapeMemento; previous: string | null } | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 3);
    [this.id, this.attribute, this.token] = args;
  }

  execute(): CommandResult {
    const shape = this.workspace.document().requireShape(this.id);
    const memento = shape.capture();
    const previous = shape.display(this.attribute);
    shape.set(this.attribute, this.token);
    this.updated = { shape, memento, previous };
    return new CommandResult().line(`${shape.label()} updated: ${this.attribute}=${shape.display(this.attribute)}`);
  }

  undo(): CommandResult {
    if (this.updated === null) {
      throw new Error('undo before execute');
    }
    const { shape, memento, previous } = this.updated;
    memento.restore();
    const restored = previous === null ? `${this.attribute} unset` : `${this.attribute}=${previous}`;
    return new CommandResult().line(`${shape.label()} updated: ${restored}`);
  }
}
