import { describe, expect, it } from 'vitest';
import ParseError from '../../src/frontend/ParseError';
import Tokenizer from '../../src/frontend/Tokenizer';

const tokenizer = new Tokenizer();

describe('Tokenizer', () => {
  it('双引号内为一个参数，引号不计入值', () => {
    expect(tokenizer.tokenize('create text t1 20 40 "My Diagram"')).toEqual([
      'create',
      'text',
      't1',
      '20',
      '40',
      'My Diagram',
    ]);
  });

  it('连续空白、制表符与首尾空白不产生空参数', () => {
    expect(tokenizer.tokenize('  move\tr1   10  -5 ')).toEqual(['move', 'r1', '10', '-5']);
  });

  it('空引号是一个空参数', () => {
    expect(tokenizer.tokenize('set t1 text ""')).toEqual(['set', 't1', 'text', '']);
  });

  it('引号与相邻字符拼成同一个参数', () => {
    expect(tokenizer.tokenize('a"b c"d e')).toEqual(['ab cd', 'e']);
  });

  it('支持非 ASCII 内容', () => {
    expect(tokenizer.tokenize('create text 标题 1 2 "开始 节点"')).toEqual(['create', 'text', '标题', '1', '2', '开始 节点']);
  });

  it('空行得到空数组', () => {
    expect(tokenizer.tokenize('   ')).toEqual([]);
  });

  it('引号未闭合时抛出 ParseError', () => {
    const parse = () => tokenizer.tokenize('create text t1 0 0 "abc');
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow('unclosed quote');
  });
});
