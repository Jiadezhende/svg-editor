import CommandResult from '../CommandResult';
import DocumentCommand from '../DocumentCommand';
import SvgReader from '../../receiver/svg/SvgReader';
import type Workspace from '../../receiver/workspace/Workspace';

/** `read <file.svg>`：读入 SVG 文件为当前文档；读取或解析失败时当前文档不变。 */
export default class ReadCommand extends DocumentCommand {
  static override readonly command = 'read';
  static override readonly usage = 'read <file.svg>';

  private readonly path: string;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.path = args[0];
  }

  execute(): CommandResult {
    const text = this.workspace.files().read(this.path);
    const { document, warnings } = new SvgReader(this.workspace.shapes()).read(text);
    const result = new CommandResult();
    for (const warning of warnings) {
      result.warn(warning);
    }
    if (this.workspace.replace(document, this.path)) {
      result.warn('previous document discarded');
    }
    return result.line(`read ${this.path} (${document.shapes().length} elements)`);
  }
}
