import { describe, expect, it } from 'vitest';
import CoordinateAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/CoordinateAttribute';

describe('CoordinateAttribute 坐标', () => {
  const attribute = new CoordinateAttribute('cx', 'x', 5);

  it('记录属性名、轴与当前值', () => {
    expect(attribute.name()).toBe('cx');
    expect(attribute.axis()).toBe('x');
    expect(attribute.value).toBe(5);
    expect(new CoordinateAttribute('y1', 'y').axis()).toBe('y');
  });

  it('解析数字，负数与浮点均合法且无约束', () => {
    expect(attribute.withToken('-10.5').value).toBe(-10.5);
  });

  it('非数字在解析时报错', () => {
    expect(() => attribute.withToken('abc')).toThrow('not a number: abc');
  });

  it('按数值格式展示', () => {
    expect(attribute.withValue(0.1 + 0.2).display()).toBe('0.3');
  });

  it('默认值为 0', () => {
    expect(attribute.defaultValue()).toBe(0);
  });
});
