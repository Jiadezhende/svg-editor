import { EditorError, type CommandSession } from './backend';
import type CommandReader from './frontend/CommandReader';
import ParseError from './frontend/ParseError';
import type ResultPrinter from './frontend/ResultPrinter';

/**
 * 组织 CLI 主循环：读取参数、执行命令、展示结果，并统一输出用户可纠正的错误。
 */
export default class App {
  private readonly reader: CommandReader;
  private readonly printer: ResultPrinter;
  private readonly client: CommandSession;

  constructor(reader: CommandReader, printer: ResultPrinter, client: CommandSession) {
    this.reader = reader;
    this.printer = printer;
    this.client = client;
  }

  /** 运行至请求退出或输入结束。 */
  async run(): Promise<void> {
    this.printer.printBanner();
    while (!this.client.isExitRequested()) {
      try {
        const tokens = await this.reader.next();
        if (tokens === null) {
          return;
        }
        const result = this.client.execute(tokens);
        this.printer.printResult(result.warnings(), result.lines());
      } catch (error) {
        if (!(error instanceof ParseError || error instanceof EditorError)) {
          throw error;
        }
        this.printer.printError(error.message);
      }
    }
  }
}
