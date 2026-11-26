import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import type { Shape } from '../../src/backend';
import type { ShapeMemento } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/**
 * `set <id> <attr> <value>`：由 Receiver 用同一次匹配完成写入、整图校验和前后回显。
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
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 3);
    [this.id, this.attribute, this.token] = args;
  }

  execute(): CommandResult {
    const shape = this.receiver.document().requireNode(this.id).value;
    const memento = shape.capture();
    try {
      const { previous, current } = this.receiver.set(shape, this.attribute, this.token);
      this.updated = { shape, memento, previous };
      return new CommandResult().line(`${shape.label()} updated: ${this.attribute}=${current}`);
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
