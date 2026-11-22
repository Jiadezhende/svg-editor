import App from './App';
import { bootstrapEditor } from './bootstrap';
import CommandReader from './frontend/CommandReader';
import ResultPrinter from './frontend/ResultPrinter';
import ConsoleInputSource from './frontend/io/ConsoleInputSource';
import ConsoleOutputSink from './frontend/io/ConsoleOutputSink';

// 自动发现全部插件，单插件失败只报告错误，保留有效装配继续启动。
const { client } = await bootstrapEditor();

const input = new ConsoleInputSource();
const output = new ConsoleOutputSink();
const reader = new CommandReader(input, output);
const printer = new ResultPrinter(output);
const app = new App(reader, printer, client);

try {
  await app.run();
} finally {
  input.close();
}
