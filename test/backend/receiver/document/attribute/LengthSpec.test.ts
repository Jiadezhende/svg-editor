import { describe, expect, it } from 'vitest';
import LengthSpec from '../../../../../src/backend/receiver/document/attribute/LengthSpec';
import EditorError from '../../../../../src/backend/error/EditorError';

describe('LengthSpec 尺寸', () => {
  const spec = new LengthSpec('width');

  it('解析数字；负数可以解析，约束在 check 中', () => {
    expect(spec.parse('-1')).toBe(-1);
    expect(() => spec.parse('a')).toThrow('not a number: a');
  });

  it('0 与正数满足约束，负数报错', () => {
    expect(() => spec.check(0)).not.toThrow();
    expect(() => spec.check(12.5)).not.toThrow();
    expect(() => spec.check(-0.5)).toThrow(new EditorError('width must be non-negative'));
  });

  it('按数值格式展示', () => {
    expect(spec.display(100)).toBe('100');
  });

  it('不是坐标；平移不变，缩放时乘以系数', () => {
    expect(spec.axis()).toBeNull();
    expect(spec.translate(50, 10, 10)).toBe(50);
    expect(spec.scale(50, 2)).toBe(100);
  });
});
