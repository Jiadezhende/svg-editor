import { describe, expect, it } from 'vitest';
import ResultPrinter from '../../src/frontend/ResultPrinter';
import MemoryOutputSink from '../support/MemoryOutputSink';

describe('ResultPrinter', () => {
  it('打印横幅', () => {
    const output = new MemoryOutputSink();
    new ResultPrinter(output).printBanner();
    expect(output.lines()).toEqual(["svg-editor 0.1 — type 'help' for commands"]);
  });

  it('警告带 warning: 前缀，先于结果行输出', () => {
    const output = new MemoryOutputSink();
    new ResultPrinter(output).printResult(['assigned id rect1', 'second'], ['read other.svg (7 elements)']);
    expect(output.lines()).toEqual(['warning: assigned id rect1', 'warning: second', 'read other.svg (7 elements)']);
  });

  it('空结果不输出任何内容', () => {
    const output = new MemoryOutputSink();
    new ResultPrinter(output).printResult([], []);
    expect(output.text()).toBe('');
  });

  it('错误输出为一行 error: <消息>', () => {
    const output = new MemoryOutputSink();
    new ResultPrinter(output).printError('unknown command: foo');
    expect(output.lines()).toEqual(['error: unknown command: foo']);
  });
});
