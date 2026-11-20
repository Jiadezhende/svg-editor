import { CommandResult } from '../../src/backend';
import { DocumentCommand } from '../../src/backend';
import type { Workspace } from '../../src/backend';

/** `save [file.svg]`：保存当前文档；无参时保存到当前路径，带参时保存到该路径并使其成为当前路径。 */
export default class SaveCommand extends DocumentCommand {
  override successKind(): 'save' { return 'save'; }
  static override readonly command = 'save';
  static override readonly usage = 'save [file.svg]';

  /** 另存为的目标；无参时为 null。 */
  private readonly target: string | null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0, 1);
    this.target = args[0] ?? null;
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const path = this.target ?? this.workspace.path();
    this.workspace.files().write(path, this.workspace.svgWriter().write(doc));
    this.workspace.setPath(path);
    return new CommandResult().line(`saved to ${path} (${doc.nodes().length} elements)`);
  }
}
