import App from './App';
import { createClient } from './host/defaults';
import ConsoleInputSource from './frontend/io/ConsoleInputSource';
import ConsoleOutputSink from './frontend/io/ConsoleOutputSink';

// 入口只连接宿主默认装配与控制台 IO；插件发现留在后续装配阶段。
const client = createClient();

const input = new ConsoleInputSource();
await new App(input, new ConsoleOutputSink(), client).run();
input.close();
