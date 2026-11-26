import { CommandResult, EditCommand } from '../../src/backend';
import type { EditSnapshot, Receiver } from '../../src/backend';

/**
 * `set <id> <attr> <value>`：由 Receiver 用同一次匹配完成写入、整图校验和前后回显。
 * 快照覆盖本次编辑；失败由基类恢复，成功后撤销记录才生效。
 */
export default class SetCommand extends EditCommand {
  static override readonly command = 'set';
  static override readonly usage = 'set <id> <attr> <value>';

  private readonly id: string;
  private readonly attribute: string;
  private readonly token: string;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 3);
    [this.id, this.attribute, this.token] = args;
  }

  protected snapshot(): EditSnapshot {
    return this.receiver.document().requireNode(this.id).value.capture();
  }

  protected apply(): { result: CommandResult; undo: string } {
    const shape = this.receiver.document().requireNode(this.id).value;
    const { previous, current } = this.receiver.set(shape, this.attribute, this.token);
    const restored = previous === null ? `${this.attribute} unset` : `${this.attribute}=${previous}`;
    return {
      result: new CommandResult().line(`${shape.label()} updated: ${this.attribute}=${current}`),
      undo: `${shape.label()} updated: ${restored}`,
    };
  }
}
