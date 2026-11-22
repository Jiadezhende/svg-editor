import { Command } from '../../src/backend';
import { CommandResult } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/**
 * `tree [id]`：以树形输出文档结构，每行内联图形的核心属性。
 * 无参时以画布根为根，首行 `svg (<w>x<h>)`；有参时只输出以该图形为根的子树。
 */
export default class TreeCommand extends Command {
  static override readonly command = 'tree';
  static override readonly usage = 'tree [id]';

  /** 子树的根；无参（全文档）时为 null。 */
  private readonly id: string | null;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0, 1);
    this.id = args[0] ?? null;
  }

  execute(): CommandResult {
    const doc = this.receiver.document();
    const result = new CommandResult();
    const root = this.id === null ? null : doc.requireNode(this.id);
    for (const line of this.receiver.renderTree(root)) result.line(line);
    return result;
  }
}
