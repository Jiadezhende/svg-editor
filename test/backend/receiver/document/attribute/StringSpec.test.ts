import { describe, expect, it } from 'vitest';
import StringSpec from '../../../../../src/backend/receiver/document/attribute/StringSpec';

describe('StringSpec 字符串属性', () => {
  const spec = new StringSpec('fill');

  it.each(['#eee', 'red', 'My Diagram', '开始', ''])('原样解析与展示 %j，无约束', (token) => {
    expect(spec.parse(token)).toBe(token);
    expect(() => spec.check(token)).not.toThrow();
    expect(spec.display(token)).toBe(token);
  });

  it('不是坐标；平移、缩放都不变', () => {
    expect(spec.axis()).toBeNull();
    expect(spec.translate('red', 10, 10)).toBe('red');
    expect(spec.scale('red', 2)).toBe('red');
  });

  it('默认值为空串', () => {
    expect(spec.defaultValue()).toBe('');
  });
});
