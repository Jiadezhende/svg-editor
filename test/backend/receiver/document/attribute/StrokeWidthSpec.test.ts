import { describe, expect, it } from 'vitest';
import StrokeWidthSpec from '../../../../../src/backend/receiver/document/attribute/StrokeWidthSpec';

describe('StrokeWidthSpec 线宽', () => {
  const spec = new StrokeWidthSpec('stroke-width');

  it('解析数字并按数值格式输出', () => {
    expect(spec.format(spec.parse('2.50'))).toBe('2.5');
  });

  it('不得为负', () => {
    expect(() => spec.check(0)).not.toThrow();
    expect(() => spec.check(-1)).toThrow('stroke-width must be non-negative');
  });
});
