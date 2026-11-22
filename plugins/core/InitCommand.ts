import { DocumentCommand } from '../../src/backend';
import { CommandResult } from '../../src/backend';
import { Document } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** `init [w] [h]`：新建文档并替换当前文档，默认画布 800×600；覆盖已有文档时给出警告。 */
export default class InitCommand extends DocumentCommand {
  static override readonly command = 'init';
  static override readonly usage = 'init [w] [h]';

  private readonly width: number;
  private readonly height: number;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0, 2);
    this.width = args.length > 0 ? this.parseNumber(args[0]) : 800;
    this.height = args.length > 0 ? this.parseNumber(args[1]) : 600;
  }

  execute(): CommandResult {
    const result = new CommandResult();
    if (this.receiver.replace(new Document(this.width, this.height))) {
      result.warn('previous document discarded');
    }
    return result.line(`canvas ${this.formatNumber(this.width)}x${this.formatNumber(this.height)} created`);
  }
}
