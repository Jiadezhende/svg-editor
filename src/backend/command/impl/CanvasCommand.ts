import Command from '../Command';
import CommandResult from '../CommandResult';
import type Document from '../../receiver/document/Document';
import type Workspace from '../../receiver/workspace/Workspace';

/** `canvas [<w> <h>]`：无参时显示当前画布尺寸，带参时修改尺寸。 */
export default class CanvasCommand extends Command {
  static override readonly command = 'canvas';
  static override readonly usage = 'canvas [<w> <h>]';

  /** 要修改成的尺寸；无参（仅显示）时为 null。 */
  private readonly size: readonly [number, number] | null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0, 2);
    this.size = args.length > 0 ? [this.parseNumber(args[0]), this.parseNumber(args[1])] : null;
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    if (this.size === null) {
      return new CommandResult().line(`canvas ${this.describe(doc)}`);
    }
    doc.resize(...this.size);
    return new CommandResult().line(`canvas resized to ${this.describe(doc)}`);
  }

  private describe(doc: Document): string {
    return `${this.formatNumber(doc.width())}x${this.formatNumber(doc.height())}`;
  }
}
