import { describe, expect, it } from 'vitest';
import StringSpec from '../../../../../src/backend/receiver/document/attribute/StringSpec';

describe('StringSpec 字符串属性', () => {
  const spec = new StringSpec('fill');

  it.each(['#eee', 'red', 'My Diagram', '开始', ''])('原样解析与输出 %j，无约束', (token) => {
    expect(spec.parse(token)).toBe(token);
    expect(() => spec.check(token)).not.toThrow();
    expect(spec.format(token)).toBe(token);
  });
});
