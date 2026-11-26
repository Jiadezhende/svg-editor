import { describe, expect, it, vi } from 'vitest';
import { CoordinateAttribute, Shape, ShapeFactory, TextAttribute } from '../../../../../src/backend';
import type { ShapeParseResult } from '../../../../../src/backend';

class Marker extends Shape {
  static override readonly type = 'marker';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new TextAttribute('text')];
  static override readonly content = 'text';
}

describe('Shape 数据解析契约', () => {
  it('默认解析复用属性规格、默认值和构造校验，叶子不请求子 Shape', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const children = vi.fn(() => []);
    const { shape, children: remaining } = factory.parse('marker', 'm', new Map([['x', '2.50'], ['unknown', 'ignored']]), children);
    expect(shape).toBeInstanceOf(Marker);
    expect(shape.value('x')).toBe(2.5);
    expect(shape.value('text')).toBe('');
    expect(shape.value('unknown')).toBeNull();
    expect(remaining).toEqual([]);
    expect(children).not.toHaveBeenCalled();
    expect(() => factory.parse('marker', 'm', new Map([['x', 'bad']]))).toThrow('not a number: bad');
    expect(() => factory.parse('marker', '1bad', new Map())).toThrow('invalid id: 1bad');
  });

  it('默认容器返回输入子 Shape 引用，不维护文档关系', () => {
    class Group extends Shape {
      static override readonly type = 'g';
      override acceptsChildren(): boolean { return true; }
    }
    const child = Marker.parse('m', new Map()).shape;
    const result = Group.parse('g', new Map(), () => [child]);
    expect(result.children).toEqual([child]);
    expect(result.children[0]).toBe(child);
  });

  it('特殊类覆写解析并消费输入部件，工厂不公开构造函数', () => {
    class Composite extends Shape {
      static override readonly type = 'composite';
      static override parse(id: string, attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
        const parts = readChildren();
        if (parts.length !== 1 || !(parts[0] instanceof Marker)) throw new Error('invalid parts');
        return { shape: new Composite(id, this.parseValues(attributes)), children: [] };
      }
    }
    const factory = new ShapeFactory();
    factory.register(Composite);
    expect(factory.parse('composite', 'c', new Map(), () => [Marker.parse('m', new Map()).shape]).shape).toBeInstanceOf(Composite);
    expect(() => factory.parse('composite', 'c', new Map())).toThrow('invalid parts');
    if (false) {
      // @ts-expect-error 规格视图仍不提供模型构造或解析入口。
      factory.definition('composite').parse('c', new Map());
    }
  });
});
