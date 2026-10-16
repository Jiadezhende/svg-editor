import type OutputSink from './OutputSink';

/** 控制台输出：写到 stdout。 */
export default class ConsoleOutputSink implements OutputSink {
  write(text: string): void {
    process.stdout.write(text);
  }

  writeLine(text: string): void {
    process.stdout.write(`${text}\n`);
  }
}
