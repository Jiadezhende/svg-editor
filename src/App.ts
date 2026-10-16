import type Client from './backend/Client';
import EditorError from './backend/error/EditorError';
import CommandReader from './frontend/CommandReader';
import type InputSource from './frontend/io/InputSource';
import type OutputSink from './frontend/io/OutputSink';
import ParseError from './frontend/ParseError';
import ResultPrinter from './frontend/ResultPrinter';

/**
 * 前后端通信与主循环：前端负责读入与展示，后端负责执行，两者互不依赖。
 * 前后端之间的数据转换只在这里进行：参数数组交给后端，CommandResult 拆成字符串交给前端，两侧的错误统一输出。
 */
export default class App {
  private readonly reader: CommandReader;
  private readonly printer: ResultPrinter;

  constructor(
    input: InputSource,
    output: OutputSink,
    private readonly client: Client,
  ) {
    this.reader = new CommandReader(input, output);
    this.printer = new ResultPrinter(output);
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
