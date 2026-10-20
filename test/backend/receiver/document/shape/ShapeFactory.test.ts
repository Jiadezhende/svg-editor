import { describe, expect, it } from 'vitest';
import ShapeFactory from '../../../../../src/backend/receiver/document/shape/ShapeFactory';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import Rect from '../../../../../src/backend/receiver/document/shape/Rect';
import Shape from '../../../../../src/backend/receiver/document/shape/Shape';
import EditorError from '../../../../../src/backend/error/EditorError';

class Hexagon extends Shape {
  static override readonly type = 'hexagon';
}

describe('ShapeFactory 图形工厂', () => {
  it.each(['rect', 'circle', 'ellipse', 'line', 'text', 'g'])('内置类型 %s 已注册', (type) => {
    expect(new ShapeFactory().lookup(type).type).toBe(type);
  });

  it('按类型名取到对应的图形类', () => {
    const factory = new ShapeFactory();
    expect(factory.lookup('rect')).toBe(Rect);
    expect(factory.lookup('g')).toBe(Group);
  });

  it.each(['hexagon', 'box', 'Rect', ''])('未注册的类型 %j 报错', (type) => {
    expect(() => new ShapeFactory().lookup(type)).toThrow(
      new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`),
    );
  });

  it('可注册新类型，注册后即可查到', () => {
    const factory = new ShapeFactory();
    factory.register(Hexagon);
    expect(factory.lookup('hexagon')).toBe(Hexagon);
  });

  it('类型名缺失或重名属于程序缺陷', () => {
    class Unnamed extends Shape {}
    const factory = new ShapeFactory();
    expect(() => factory.register(Unnamed)).toThrow('must declare static type');
    expect(() => factory.register(Rect)).toThrow('duplicate shape type: rect');
  });
});

describe('ShapeFactory 锚点校验', () => {
  it('锚点不是本类的 x / y 坐标属性时启动即失败', () => {
    class Missing extends Shape {
      static override readonly type = 'missing';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['cx', 'cy'];
    }
    class Swapped extends Shape {
      static override readonly type = 'swapped';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['y', 'x'];
    }
    class NotCoordinate extends Shape {
      static override readonly type = 'length';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['width', 'y'];
    }
    const factory = new ShapeFactory();
    expect(() => factory.register(Missing)).toThrow('missing anchor cx must be a x coordinate');
    expect(() => factory.register(Swapped)).toThrow('swapped anchor y must be a x coordinate');
    expect(() => factory.register(NotCoordinate)).toThrow('length anchor width must be a x coordinate');
  });

  it('没有锚点的类型可正常注册', () => {
    const factory = new ShapeFactory();
    factory.register(Hexagon);
    expect(factory.lookup('hexagon').anchor).toBeNull();
  });
});
