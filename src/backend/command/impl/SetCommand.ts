import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import type Shape from '../../receiver/document/shape/Shape';
import type ShapeMemento from '../../receiver/document/shape/ShapeMemento';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `set <id> <attr> <value>`：优先调用首个匹配的静态 Handler，零命中时使用模型属性规则。
 * 模型快照覆盖本次编辑及回显计算；失败不替换已有撤销记录。
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
    const shape = this.workspace.document().requireNode(this.id).value;
    const handler = this.workspace.attributeHandlers().resolve(shape, this.attribute);
    const memento = shape.capture();
    const display = () => handler === null
      ? shape.display(this.attribute)
      : handler.display(shape, this.attribute);
    try {
      const previous = display();
      if (handler === null) shape.set(this.attribute, this.token);
      else handler.apply(shape, this.attribute, this.token);
      const result = new CommandResult().line(`${shape.label()} updated: ${this.attribute}=${display()}`);
      this.updated = { shape, memento, previous };
      return result;
    } catch (error) {
      memento.restore();
      throw error;
    }
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
