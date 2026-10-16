import { readdirSync } from 'node:fs';
import App from './App';
import Client from './backend/Client';
import ConsoleInputSource from './frontend/io/ConsoleInputSource';
import ConsoleOutputSink from './frontend/io/ConsoleOutputSink';

// 入口：扫描 backend/command/impl/ 注册全部 ConcreteCommand，组装控制台 IO、Client、App 后启动。

const client = new Client();
const implDir = new URL('./backend/command/impl/', import.meta.url);
for (const file of readdirSync(implDir).filter((name) => name.endsWith('.ts')).sort()) {
  const module = await import(new URL(file, implDir).href);
  client.register(module.default);
}

const input = new ConsoleInputSource();
await new App(input, new ConsoleOutputSink(), client).run();
input.close();
