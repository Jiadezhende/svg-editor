import { describe, expect, it } from 'vitest';
import TextSpec from '../../../../../src/backend/receiver/document/attribute/TextSpec';

describe('TextSpec 文本内容', () => {
  const spec = new TextSpec('text');

  it('原样解析，无约束', () => {
    expect(spec.parse('My Diagram')).toBe('My Diagram');
    expect(() => spec.check('')).not.toThrow();
  });

  it('format 给出值本身，不带引号', () => {
    expect(spec.format('My Diagram')).toBe('My Diagram');
  });

  it.each([
    ['My Diagram', '"My Diagram"'],
    ['开始', '"开始"'],
    ['', '""'],
  ])('display %j 输出为 %s', (value, expected) => {
    expect(spec.display(value)).toBe(expected);
  });
});
