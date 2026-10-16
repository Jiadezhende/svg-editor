import { describe, expect, it } from 'vitest';
import CommandReader from '../../src/frontend/CommandReader';
import MemoryInputSource from '../support/MemoryInputSource';
import MemoryOutputSink from '../support/MemoryOutputSink';

describe('CommandReader 交互模式', () => {
  it('每次读取前打印提示符，不回显输入', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['move r1 1 2'], true), output);
    expect(await reader.next()).toEqual(['move', 'r1', '1', '2']);
    expect(output.text()).toBe('svg> ');
  });

  it('跳过注释与空行，每跳过一行重新打印提示符', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['# comment', '', 'help'], true), output);
    expect(await reader.next()).toEqual(['help']);
    expect(output.text()).toBe('svg> svg> svg> ');
  });

  it('EOF 时返回 null 并换行', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource([], true), output);
    expect(await reader.next()).toBeNull();
    expect(output.text()).toBe('svg> \n');
  });
});

describe('CommandReader 脚本模式', () => {
  it('不打印提示符，回显 svg> <原始行>', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['  move r1 1 2'], false), output);
    expect(await reader.next()).toEqual(['move', 'r1', '1', '2']);
    expect(output.lines()).toEqual(['svg>   move r1 1 2']);
  });

  it('注释行回显但不返回，空行既不回显也不返回', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['# comment', '', '   ', '  # indented', 'help'], false), output);
    expect(await reader.next()).toEqual(['help']);
    expect(output.lines()).toEqual(['svg> # comment', 'svg>   # indented', 'svg> help']);
  });

  it('EOF 时返回 null，不额外输出', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['', '# end'], false), output);
    expect(await reader.next()).toBeNull();
    expect(output.lines()).toEqual(['svg> # end']);
  });

  it('引号未闭合时先回显再报错', async () => {
    const output = new MemoryOutputSink();
    const reader = new CommandReader(new MemoryInputSource(['create text t1 0 0 "abc'], false), output);
    await expect(reader.next()).rejects.toThrow('unclosed quote');
    expect(output.lines()).toEqual(['svg> create text t1 0 0 "abc']);
  });
});
