import type OutputSink from './io/OutputSink';

/** 输出约定的唯一实现处：横幅、结果（先警告后结果行）与错误。 */
export default class ResultPrinter {
  private static readonly BANNER = "svg-editor 0.1 — type 'help' for commands";

  constructor(private readonly output: OutputSink) {}

  printBanner(): void {
    this.output.writeLine(ResultPrinter.BANNER);
  }

  /** 先逐条输出警告，再输出结果行。 */
  printResult(warnings: readonly string[], lines: readonly string[]): void {
    for (const message of warnings) {
      this.output.writeLine(`warning: ${message}`);
    }
    for (const text of lines) {
      this.output.writeLine(text);
    }
  }

  printError(message: string): void {
    this.output.writeLine(`error: ${message}`);
  }
}
