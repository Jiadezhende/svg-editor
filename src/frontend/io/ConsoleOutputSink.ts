import type OutputSink from './OutputSink';

/** 控制台输出：写到 stdout；stdout 为终端且支持颜色（未设置 NO_COLOR 等）时视为彩色输出。 */
export default class ConsoleOutputSink implements OutputSink {
  readonly colorful = process.stdout.isTTY === true && process.stdout.hasColors();

  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    process.stdout.write(`${text}\n`);
  }
}
