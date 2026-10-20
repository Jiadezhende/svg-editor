import Command from '../Command';
import CommandResult from '../CommandResult';
import type Workspace from '../../receiver/workspace/Workspace';

/** `canvas`：显示当前画布尺寸（显示类）。与 CanvasResizeCommand 同名，只接受无参。 */
export default class CanvasShowCommand extends Command {
  static override readonly command = 'canvas';
  static override readonly usage = 'canvas';

  static override accepts(args: readonly string[]): boolean {
    return args.length === 0;
  }

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0);
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    return new CommandResult().line(`canvas ${this.formatNumber(doc.width())}x${this.formatNumber(doc.height())}`);
  }
}
