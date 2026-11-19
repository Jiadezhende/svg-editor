import CommandResult from '../CommandResult';
import StructureCommand from '../StructureCommand';
import type Workspace from '../../receiver/workspace/Workspace';

export default class DeleteCommand extends StructureCommand {
  static override readonly command = 'delete';
  static override readonly usage = 'delete <id>';
  private readonly id: string;

  constructor(private readonly workspace: Workspace, args: readonly string[]) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    return this.edit(doc, () => {
      const node = doc.requireNode(this.id);
      const parent = doc.parent(node);
      doc.remove(node);
      return {
        result: new CommandResult().line(`${node.value.label()} deleted`),
        undo: `${node.value.label()} restored into ${parent?.value.label() ?? 'svg'}`,
      };
    });
  }
}
