import type OutputSink from '../../src/frontend/io/OutputSink';

/** 内存输出端：累积全部输出文本。 */
export default class MemoryOutputSink implements OutputSink {
  private buffer = '';

  write(text: string): void {
    this.buffer += text;
  }

  writeLine(text: string): void {
    this.buffer += `${text}\n`;
  }

  text(): string {
    return this.buffer;
  }

  /** 按行切分的输出（忽略末尾换行）。 */
  lines(): string[] {
    return this.buffer === '' ? [] : this.buffer.replace(/\n$/, '').split('\n');
  }
}
