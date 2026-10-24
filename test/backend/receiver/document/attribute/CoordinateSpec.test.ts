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

  it('按数值格式展示', () => {
    expect(spec.display(0.1 + 0.2)).toBe('0.3');
  });

  it('平移按轴加上偏移：x 轴加 dx，y 轴加 dy', () => {
    expect(spec.translate(100, 30, -5)).toBe(130);
    expect(new CoordinateSpec('cy', 'y').translate(100, 30, -5)).toBe(95);
  });

  it('缩放时乘以系数（以原点为中心）', () => {
    expect(spec.scale(100, 2)).toBe(200);
    expect(spec.scale(-10, 0.5)).toBe(-5);
  });

  it('默认值为 0', () => {
    expect(spec.defaultValue()).toBe(0);
  });
});
