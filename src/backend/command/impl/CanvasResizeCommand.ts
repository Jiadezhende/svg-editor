import CommandResult from '../CommandResult';
import DocumentCommand from '../DocumentCommand';
import type Workspace from '../../receiver/workspace/Workspace';

/** `canvas <w> <h>`：修改画布尺寸（文档类），不改动 viewBox。与 CanvasShowCommand 同名，接受有参的输入。 */
export default class CanvasResizeCommand extends DocumentCommand {
  static override readonly command = 'canvas';
  static override readonly usage = 'canvas <w> <h>';

  /** 有参即本形式；个数由构造函数校验，`canvas 400` 报本形式的语法。 */
  static override accepts(args: readonly string[]): boolean {
    return args.length > 0;
  }

  private readonly width: number;
  private readonly height: number;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 2);
    this.width = this.parseNumber(args[0]);
    this.height = this.parseNumber(args[1]);
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    doc.resize(this.width, this.height);
    return new CommandResult().line(`canvas resized to ${this.formatNumber(doc.width())}x${this.formatNumber(doc.height())}`);
  }
}
