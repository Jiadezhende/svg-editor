import { describe, expect, it } from 'vitest';
import NumericAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/NumericAttribute';

describe('NumericAttribute 数值', () => {
  const attribute = new NumericAttribute('x', 5);

  it('记录属性名与当前值', () => {
    expect(attribute.name()).toBe('x');
    expect(attribute.value).toBe(5);
  });

  it('解析数字，负数与浮点均合法且无额外约束', () => {
    expect(attribute.withToken('-10.5').value).toBe(-10.5);
    expect(attribute.withToken('0').value).toBe(0);
  });

  it('非数字在解析时报错', () => {
    expect(() => attribute.withToken('abc')).toThrow('not a number: abc');
  });

  it('按数值格式展示', () => {
    expect(attribute.withValue(0.1 + 0.2).display()).toBe('0.3');
  });

  it('拒绝非有限值', () => {
    expect(() => attribute.withValue(NaN)).toThrow('x must be a finite number');
    expect(() => attribute.withValue(Infinity)).toThrow('x must be a finite number');
  });

  it('默认值为 0', () => {
    expect(new NumericAttribute('x').defaultValue()).toBe(0);
  });

  it('重新构造仍为可直接实例化的数值属性', () => {
    expect(attribute.withValue(7)).toBeInstanceOf(NumericAttribute);
    expect(attribute.withToken('7').value).toBe(7);
  });
});
