import { createInterface, type Interface } from 'node:readline';
import type InputSource from './InputSource';

/**
 * 控制台输入：基于 readline 逐行读取 stdin，用 `stdin.isTTY` 判断是否交互模式。
 * 不启用 readline 的终端模式，回显与行编辑交给终端本身，提示符由 CommandReader 输出。
 */
export default class ConsoleInputSource implements InputSource {
  readonly interactive = process.stdin.isTTY === true;
  private readonly reader: Interface = createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity });
  private readonly lines: AsyncIterator<string> = this.reader[Symbol.asyncIterator]();

  async next(): Promise<string | null> {
    const { done, value } = await this.lines.next();
    return done ? null : value;
  }

  /** 释放 stdin，使进程在 exit / quit 后能正常结束。 */
  close(): void {
    this.reader.close();
  }
}
