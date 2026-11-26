import { describe, expect, it } from 'vitest';
import StringAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/StringAttribute';

describe('StringAttribute 字符串属性', () => {
  const attribute = new StringAttribute('fill');

  it('原样保存与展示', () => {
    expect(attribute.withToken('red').value).toBe('red');
    expect(attribute.withToken('red').display()).toBe('red');
  });

  it('拒绝非字符串', () => {
    expect(() => attribute.withValue(123 as unknown as string)).toThrow('fill must be a string');
  });

  it('默认值为空串', () => {
    expect(attribute.defaultValue()).toBe('');
  });
});
