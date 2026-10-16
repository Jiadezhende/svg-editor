import type Client from './backend/Client';
import EditorError from './common/EditorError';
import CommandReader from './frontend/CommandReader';
import type InputSource from './frontend/io/InputSource';
import type OutputSink from './frontend/io/OutputSink';
import ResultPrinter from './frontend/ResultPrinter';

/**
 * 前后端通信与主循环：前端负责读入与展示，后端负责执行，两者只经由 App 交互。
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
        this.printer.printResult(this.client.execute(tokens));
      } catch (error) {
        if (!(error instanceof EditorError)) {
          throw error;
        }
        this.printer.printError(error.message);
      }
    }
  }
}
