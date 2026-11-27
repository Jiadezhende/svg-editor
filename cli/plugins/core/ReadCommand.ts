import { CommandResult } from '../../src/backend';
import { DocumentCommand } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** `read <file.svg>`：读入 SVG 文件为当前文档；读取或解析失败时当前文档不变。 */
export default class ReadCommand extends DocumentCommand {
  static override readonly command = 'read';
  static override readonly usage = 'read <file.svg>';

  private readonly path: string;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.path = args[0];
  }

  execute(): CommandResult {
    const { document, warnings, replaced } = this.receiver.readDocument(this.path);
    const result = new CommandResult();
    for (const warning of warnings) {
      result.warn(warning);
    }
    if (replaced) {
      result.warn('previous document discarded');
    }
    return result.line(`read ${this.path} (${document.elementCount()} elements)`);
  }
}
