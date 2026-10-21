import CommandResult from '../CommandResult';
import DocumentCommand from '../DocumentCommand';
import SvgWriter from '../../receiver/svg/SvgWriter';
import type Workspace from '../../receiver/workspace/Workspace';

/** `save [file.svg]`：保存当前文档；无参时保存到当前路径，带参时保存到该路径并使其成为当前路径。 */
export default class SaveCommand extends DocumentCommand {
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
    this.workspace.files().write(path, new SvgWriter().write(doc));
    this.workspace.setPath(path);
    return new CommandResult().line(`saved to ${path} (${doc.shapes().length} elements)`);
  }
}
