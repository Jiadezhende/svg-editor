import { describe, expect, it } from 'vitest';
import StrokeWidthAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/StrokeWidthAttribute';
import EditorError from '../../../../../../src/backend/error/EditorError';

describe('StrokeWidthAttribute 线宽', () => {
  const attribute = new StrokeWidthAttribute('stroke-width', 2);

  it('负数报错，0 与正数合法', () => {
    expect(() => attribute.withToken('-1')).toThrow(new EditorError('stroke-width must be non-negative'));
    expect(attribute.withToken('0').value).toBe(0);
    expect(attribute.withToken('2.5').value).toBe(2.5);
  });

  it('按数值格式展示', () => {
    expect(attribute.display()).toBe('2');
  });

  it('平移与缩放都保持原值', () => {
    expect(attribute.translate(10, 10).value).toBe(2);
    expect(attribute.scale(2).value).toBe(2);
  });

  it('不是坐标', () => {
    expect(attribute.axis()).toBeNull();
  });
});
