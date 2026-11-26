import { describe, expect, it } from 'vitest';
import LengthAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/LengthAttribute';
import EditorError from '../../../../../../src/backend/error/EditorError';

describe('LengthAttribute 尺寸', () => {
  const attribute = new LengthAttribute('width', 10);

  it('解析数字；负数在解析后校验时报错', () => {
    expect(attribute.withToken('12.5').value).toBe(12.5);
    expect(() => attribute.withToken('-1')).toThrow(new EditorError('width must be non-negative'));
    expect(() => attribute.withToken('a')).toThrow('not a number: a');
  });

  it('0 与正数满足约束', () => {
    expect(attribute.withValue(0).value).toBe(0);
  });

  it('按数值格式展示', () => {
    expect(attribute.display()).toBe('10');
  });

  it('不是坐标；平移不变，缩放时乘以系数', () => {
    expect(attribute.axis()).toBeNull();
    expect(attribute.translate(10, 10).value).toBe(10);
    expect(attribute.scale(2).value).toBe(20);
  });

  it('重新构造后仍保留非负规则', () => {
    expect(() => attribute.withValue(5).withToken('-1')).toThrow('must be non-negative');
  });
});
