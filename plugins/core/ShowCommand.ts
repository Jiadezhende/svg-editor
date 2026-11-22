import { Command } from '../../src/backend';
import { CommandResult } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** `show <id>`：输出单个图形的全部已设置属性。 */
export default class ShowCommand extends Command {
  static override readonly command = 'show';
  static override readonly usage = 'show <id>';

  private readonly id: string;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    const result = new CommandResult().line(`${shape.label()}  parent=${node.parent()?.value.label() ?? 'svg'}`);
    const details = shape.details();
    if (shape.acceptsChildren()) details[0] = `children=${shape.view().children.length + node.children().length}`;
    for (const detail of details) {
      result.line(`  ${detail}`);
    }
    return result;
  }
}
