/** 输入源：逐行提供原始输入。 */
export default interface InputSource {
  /** 是否交互模式：交互模式打印提示符，否则（脚本回放）回显命令行。 */
  readonly interactive: boolean;

  /** 读取下一行（不含换行符）；输入结束时返回 null。 */
  next(): Promise<string | null>;
}
