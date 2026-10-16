/** 输出端。 */
export default interface OutputSink {
  /** 输出文本，不换行（用于提示符）。 */
  write(text: string): void;

  /** 输出一行。 */
  writeLine(text: string): void;
}
