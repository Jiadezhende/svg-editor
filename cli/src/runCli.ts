import App from './App';
import type { CommandSession } from './backend';
import CommandReader from './frontend/CommandReader';
import ResultPrinter from './frontend/ResultPrinter';
import ConsoleInputSource from './frontend/io/ConsoleInputSource';
import ConsoleOutputSink from './frontend/io/ConsoleOutputSink';

export async function runCli(client: CommandSession): Promise<void> {
  const input = new ConsoleInputSource();
  const output = new ConsoleOutputSink();

  try {
    await new App(new CommandReader(input, output), new ResultPrinter(output), client).run();
  } finally {
    input.close();
  }
}
