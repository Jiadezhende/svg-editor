import App from './App';
import { createDiscoveredHost } from './host/discovery';
import ConsoleInputSource from './frontend/io/ConsoleInputSource';
import ConsoleOutputSink from './frontend/io/ConsoleOutputSink';

// 自动发现全部插件，单插件失败只报告错误，保留有效装配继续启动。
const { client } = await createDiscoveredHost();

const input = new ConsoleInputSource();
await new App(input, new ConsoleOutputSink(), client).run();
input.close();
