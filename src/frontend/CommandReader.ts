import type InputSource from './io/InputSource';
import type OutputSink from './io/OutputSink';
import Tokenizer from './Tokenizer';

/**
 * 读取下一条命令：交互模式下打印提示符，脚本模式下回显 `svg> <原始行>`；
 * 跳过注释与空行（脚本模式下注释行仍回显）；分词后返回参数数组。
 * 输出端支持彩色时，提示符（含回显中的提示符）以粗体青色高亮。
 */
export default class CommandReader {
  private static readonly PROMPT = 'svg> ';
  private static readonly HIGHLIGHTED_PROMPT = '\x1b[1;36msvg>\x1b[0m ';

  private readonly tokenizer = new Tokenizer();

  constructor(
    private readonly input: InputSource,
    private readonly output: OutputSink,
  ) {}

  /** 返回下一条命令的参数数组；输入结束时返回 null；引号未闭合时抛出 ParseError。 */
  async next(): Promise<string[] | null> {
    for (;;) {
      if (this.input.interactive) {
        this.output.write(this.prompt());
      }

      const line = await this.input.next();
      if (line === null) {
        if (this.input.interactive) {
          this.output.writeLine('');
        }
        return null;
      }

      const trimmed = line.trim();
      if (trimmed === '') {
        continue;
      }
      if (!this.input.interactive) {
        this.output.writeLine(this.prompt() + line);
      }
      if (trimmed.startsWith('#')) {
        continue;
      }
      return this.tokenizer.tokenize(line);
    }
  }

  private prompt(): string {
    return this.output.colorful ? CommandReader.HIGHLIGHTED_PROMPT : CommandReader.PROMPT;
  }
}
