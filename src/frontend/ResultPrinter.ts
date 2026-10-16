import type CommandResult from '../common/CommandResult';
import type OutputSink from './io/OutputSink';

/** 输出约定的唯一实现处：横幅、结果（先警告后结果行）与错误。 */
export default class ResultPrinter {
  private static readonly BANNER = "svg-editor 0.1 — type 'help' for commands";

  constructor(private readonly output: OutputSink) {}

  printBanner(): void {
    this.output.writeLine(ResultPrinter.BANNER);
  }

  printResult(result: CommandResult): void {
    for (const message of result.warnings()) {
      this.output.writeLine(`warning: ${message}`);
    }
    for (const text of result.lines()) {
      this.output.writeLine(text);
    }
  }

  printError(message: string): void {
    this.output.writeLine(`error: ${message}`);
  }
}
