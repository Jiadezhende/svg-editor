import { describe, expect, it } from 'vitest';
import CoordinateSpec from '../../../../../src/backend/receiver/document/attribute/CoordinateSpec';

describe('CoordinateSpec 坐标', () => {
  const spec = new CoordinateSpec('cx', 'x');

  it('记录属性名与轴', () => {
    expect(spec.name()).toBe('cx');
    expect(spec.axis()).toBe('x');
    expect(new CoordinateSpec('y1', 'y').axis()).toBe('y');
  });

  it('解析数字，负数与浮点均合法且无约束', () => {
    expect(spec.parse('-10.5')).toBe(-10.5);
    expect(() => spec.check(-10.5)).not.toThrow();
  });

  it('非数字在解析时报错', () => {
    expect(() => spec.parse('abc')).toThrow('not a number: abc');
  });

  it('按数值格式输出', () => {
    expect(spec.format(0.1 + 0.2)).toBe('0.3');
  });
});
