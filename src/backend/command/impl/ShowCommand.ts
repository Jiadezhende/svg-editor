import Command from '../Command';
import CommandResult from '../CommandResult';
import type Workspace from '../../receiver/workspace/Workspace';

/** `show <id>`：输出单个图形的全部已设置属性。 */
export default class ShowCommand extends Command {
  static override readonly command = 'show';
  static override readonly usage = 'show <id>';

  private readonly id: string;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const node = doc.requireNode(this.id);
    const shape = node.value;
    const result = new CommandResult().line(`${shape.label()}  parent=${doc.parent(node)?.value.label() ?? 'svg'}`);
    const details = shape.details();
    if (shape.acceptsChildren()) details[0] = `children=${doc.children(node).length}`;
    for (const detail of details) {
      result.line(`  ${detail}`);
    }
    return result;
  }
}
