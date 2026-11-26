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

  it('平移按轴加上偏移：x 轴加 dx，y 轴加 dy', () => {
    expect(attribute.translate(30, -5).value).toBe(35);
    expect(new CoordinateAttribute('cy', 'y', 100).translate(30, -5).value).toBe(95);
  });

  it('缩放时乘以系数，并保留轴配置', () => {
    const scaled = attribute.scale(2);
    expect(scaled.value).toBe(10);
    expect(scaled.axis()).toBe('x');
  });

  it('默认值为 0', () => {
    expect(attribute.defaultValue()).toBe(0);
  });
});
