import { describe, expect, it } from 'vitest';
import CoordinateAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/CoordinateAttribute';
import StringAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/StringAttribute';

describe('Attribute 通用语义', () => {
  it('withToken 返回新属性，原属性保持未设置', () => {
    const attribute = new StringAttribute('fill');
    const next = attribute.withToken('red');
    expect(attribute.value).toBeNull();
    expect(attribute.display()).toBeNull();
    expect(next).not.toBe(attribute);
    expect(next.value).toBe('red');
    expect(next.display()).toBe('red');
  });

  it('withValue 校验运行时类型', () => {
    const attribute = new StringAttribute('fill');
    expect(() => attribute.withValue(123 as unknown as string)).toThrow('fill must be a string');
  });

  it('默认值由具体子类提供', () => {
    expect(new StringAttribute('fill').defaultValue()).toBe('');
    expect(new CoordinateAttribute('x', 'x').defaultValue()).toBe(0);
  });

  it('非坐标属性的 axis() 为 null', () => {
    expect(new StringAttribute('fill').axis()).toBeNull();
  });
});
