import { describe, expect, it } from 'vitest';
import App from '../src/App';
import Client from '../src/backend/Client';
import MemoryInputSource from './support/MemoryInputSource';
import MemoryOutputSink from './support/MemoryOutputSink';
import StubCommand from './support/StubCommand';

const BANNER = "svg-editor 0.1 — type 'help' for commands";

async function replay(lines: string[], interactive = false) {
  const client = new Client();
  client.register(StubCommand);
  const input = new MemoryInputSource(lines, interactive);
  const output = new MemoryOutputSink();
  await new App(input, output, client).run();
  return { input, output };
}

describe('App 端到端', () => {
  it('脚本模式：横幅后逐行回显并输出结果，警告先于结果行', async () => {
    const { output } = await replay(['# demo', '', 'stub a 0.1', 'stub b -0 warn']);
    expect(output.lines()).toEqual([
      BANNER,
      'svg> # demo',
      'svg> stub a 0.1',
      'a 0.1',
      'svg> stub b -0 warn',
      'warning: stub b warned',
      'b 0',
    ]);
  });

  it('交互模式：打印提示符，不回显输入', async () => {
    const { output } = await replay(['stub a 1'], true);
    expect(output.text()).toBe(`${BANNER}\nsvg> a 1\nsvg> \n`);
  });

  it('各类错误只输出一行 error，之后继续读取', async () => {
    const { output } = await replay(['foo', 'stub a', 'stub a x', 'stub "a 1', 'stub a 1']);
    expect(output.lines()).toEqual([
      BANNER,
      'svg> foo',
      'error: unknown command: foo',
      'svg> stub a',
      'error: wrong number of arguments. usage: stub <name> <n> [warn]',
      'svg> stub a x',
      'error: not a number: x',
      'svg> stub "a 1',
      'error: unclosed quote',
      'svg> stub a 1',
      'a 1',
    ]);
  });

  it.each(['exit', 'quit'])('%s 后不再读取后续命令', async (name) => {
    const { input, output } = await replay([name, 'stub a 1']);
    expect(output.lines()).toEqual([BANNER, `svg> ${name}`]);
    expect(input.remaining()).toBe(1);
  });

  it('EOF 时结束', async () => {
    const { output } = await replay([]);
    expect(output.lines()).toEqual([BANNER]);
  });
});
