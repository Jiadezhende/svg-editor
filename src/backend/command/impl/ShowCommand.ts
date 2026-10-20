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
    const shape = this.workspace.document().requireShape(this.id);
    const result = new CommandResult().line(`${shape.label()}  parent=${shape.parent().label()}`);
    for (const detail of shape.details()) {
      result.line(`  ${detail}`);
    }
    return result;
  }
}
