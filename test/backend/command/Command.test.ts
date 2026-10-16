import { describe, expect, it } from 'vitest';
import StubCommand from '../../support/StubCommand';

function run(...args: string[]): string[] {
  return [...new StubCommand(args).execute().lines()];
}

describe('Command 通用参数校验', () => {
  it('参数个数在允许范围内时正常构造', () => {
    expect(run('a', '1')).toEqual(['a 1']);
    expect(run('a', '1', 'warn')).toEqual(['a 1']);
  });

  it('参数个数不符时报错并附语法', () => {
    expect(() => new StubCommand(['a'])).toThrow('wrong number of arguments. usage: stub <name> <n> [warn]');
    expect(() => new StubCommand(['a', '1', 'warn', 'x'])).toThrow('usage: stub <name> <n> [warn]');
  });

  it('负数与浮点为合法数字', () => {
    expect(run('a', '-10')).toEqual(['a -10']);
    expect(run('a', '0.5')).toEqual(['a 0.5']);
    expect(run('a', '+3')).toEqual(['a 3']);
    expect(run('a', '.5')).toEqual(['a 0.5']);
    expect(run('a', '2.')).toEqual(['a 2']);
  });

  it.each(['a', '', '1e3', 'Infinity', 'NaN', '0x10', '1.2.3', '-', '1 '])('非数字 %j 报错', (token) => {
    expect(() => new StubCommand(['a', token])).toThrow(`not a number: ${token}`);
  });
});

describe('Command 数值输出格式', () => {
  it.each([
    ['130', '130'],
    ['0.30000000000000004', '0.3'],
    ['-0', '0'],
    ['-0.0000001', '0'],
    ['0.3333333333', '0.333333'],
    ['1.5000', '1.5'],
    ['0.000001', '0.000001'],
    ['-2.25', '-2.25'],
  ])('%s 输出为 %s', (input, expected) => {
    expect(run('a', input)).toEqual([`a ${expected}`]);
  });

  it('0.1+0.2 输出 0.3', () => {
    expect(run('a', String(0.1 + 0.2))).toEqual(['a 0.3']);
  });
});
