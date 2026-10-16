/** 输出端。 */
export default interface OutputSink {
  /** 是否支持彩色输出：输出到终端时为真，重定向到文件或管道时为假。 */
  readonly colorful: boolean;

  /** 输出文本，不换行（用于提示符）。 */
  write(text: string): void;

  /** 输出一行。 */
  writeLine(text: string): void;
}
