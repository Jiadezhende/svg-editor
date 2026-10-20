import { describe, expect, it } from 'vitest';
import type Shape from '../../../../../src/backend/receiver/document/shape/Shape';
import Rect from '../../../../../src/backend/receiver/document/shape/Rect';
import Circle from '../../../../../src/backend/receiver/document/shape/Circle';
import Ellipse from '../../../../../src/backend/receiver/document/shape/Ellipse';
import Line from '../../../../../src/backend/receiver/document/shape/Line';
import Text from '../../../../../src/backend/receiver/document/shape/Text';

// 叶子只做声明，逐类验证声明与 prd 的属性表一致。
describe.each<[typeof Shape, string, string[], string | null, string[]]>([
  [Rect, 'rect', ['x', 'y', 'width', 'height'], 'fill', ['width', 'height']],
  [Circle, 'circle', ['cx', 'cy', 'r'], 'fill', ['r']],
  [Ellipse, 'ellipse', ['cx', 'cy', 'rx', 'ry'], 'fill', ['rx', 'ry']],
  [Line, 'line', ['x1', 'y1', 'x2', 'y2'], 'stroke', []],
  [Text, 'text', ['x', 'y', 'text'], null, []],
])('%o', (cls, type, params, paint, lengths) => {
  it(`类型为 ${type}，必填参数依次为 ${params.join(' ')}，可选外观参数为 ${paint}`, () => {
    expect(cls.type).toBe(type);
    expect(cls.params.map((spec) => spec.name())).toEqual(params);
    expect(cls.paint).toBe(paint);
  });

  it('坐标可为负，只有尺寸类属性不得为负', () => {
    for (const spec of cls.params) {
      const value = spec.parse(spec.name() === 'text' ? 'hello' : '-1');
      if (lengths.includes(spec.name())) {
        expect(() => spec.check(value)).toThrow('must be non-negative');
      } else {
        expect(() => spec.check(value)).not.toThrow();
      }
    }
  });
});

describe('Text 的显示', () => {
  it('展示时内容加双引号，原值不带引号', () => {
    const text = new Text('t1', new Map<string, number | string>([['x', 20], ['y', 40], ['text', 'My Diagram']]));
    expect(text.summary()).toBe('x=20 y=40 text="My Diagram"');
    expect(text.details()).toEqual(['x=20 y=40 text="My Diagram"']);
    expect(text.value('text')).toBe('My Diagram');
  });
});
