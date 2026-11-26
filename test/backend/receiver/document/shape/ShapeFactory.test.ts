import { createShapeFactory } from '../../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import ShapeFactory from '../../../../../src/backend/receiver/document/shape/ShapeFactory';
import Group from '../../../../../plugins/core/Group';
import Rect from '../../../../../plugins/core/Rect';
import Shape from '../../../../../src/backend/receiver/document/shape/Shape';
import EditorError from '../../../../../src/backend/error/EditorError';

class Hexagon extends Shape {
  static override readonly type = 'hexagon';

  override move(): void {}
  override scale(): void {}
}

describe('ShapeFactory 图形工厂', () => {
  it('初始注册表为空，默认图形只由宿主注册', () => {
    const factory = new ShapeFactory();
    expect(factory.has('rect')).toBe(false);
    expect(factory.has('g')).toBe(false);
    expect(() => factory.create('rect', 'r')).toThrow('unknown shape type: rect');
  });

  it.each(['rect', 'circle', 'ellipse', 'line', 'text', 'g'])('宿主默认类型 %s 已注册', async (type) => {
    expect((await createShapeFactory()).definition(type).type).toBe(type);
  });

  it('按类型名和 id 构造候选实例', async () => {
    const factory = (await createShapeFactory());
    expect(factory.create('rect', 'r')).toBeInstanceOf(Rect);
    expect(factory.create('g', 'g')).toBeInstanceOf(Group);
  });

  it.each(['hexagon', 'box', 'Rect', ''])('未注册的类型 %j 报错', async (type) => {
    const factory = (await createShapeFactory());
    expect(() => factory.definition(type)).toThrow(
      new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`),
    );
    expect(() => factory.create(type, 'id')).toThrow(
      new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`),
    );
  });

  it('可注册新类型，注册后即可查到', async () => {
    const factory = (await createShapeFactory());
    factory.register(Hexagon);
    expect(factory.create('hexagon', 'h')).toBeInstanceOf(Hexagon);
  });

  it('注册时拒绝 Shape 基类和无关类', () => {
    class Unrelated {
      static readonly type = 'unrelated';
    }
    const factory = new ShapeFactory();

    expect(() => factory.register(Shape)).toThrow('shape must extend Shape');
    expect(() => factory.register(Unrelated as unknown as typeof Shape)).toThrow('shape must extend Shape');
    expect(factory.has('unrelated')).toBe(false);
  });

  it('每次创建独立候选，属性值与校验继续由模型负责', async () => {
    const factory = (await createShapeFactory());
    const first = factory.create('rect', 'r1');
    const second = factory.create('rect', 'r2');
    for (const [key, token] of [['x', '1'], ['y', '2'], ['width', '3'], ['height', '4']] as const) {
      first.set(key, token);
      second.set(key, token);
    }
    expect(first).not.toBe(second);
    first.set('width', '10');
    expect(second.value('width')).toBe(3);
    expect(first.value('width')).toBe(10);
    expect(() => factory.create('rect', '1bad')).toThrow('invalid id: 1bad');
    const bad = factory.create('rect', 'bad');
    expect(() => bad.set('width', '-1')).toThrow('width must be non-negative');
    expect(() => factory.create('rect', 'missing').validate()).toThrow('missing attribute: x');
  });

  it('类型名缺失或重名属于程序缺陷', async () => {
    class Unnamed extends Shape {
      override move(): void {}
      override scale(): void {}
    }
    const factory = (await createShapeFactory());
    expect(() => factory.register(Unnamed)).toThrow('must declare static type');
    expect(() => factory.register(Rect)).toThrow('duplicate shape type: rect');
  });
});

describe('ShapeFactory 锚点校验', () => {
  it('锚点不是本类的 x / y 坐标属性时启动即失败', async () => {
    class Missing extends Shape {
      static override readonly type = 'missing';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['cx', 'cy'];

      override move(): void {}
      override scale(): void {}
    }
    class Swapped extends Shape {
      static override readonly type = 'swapped';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['y', 'x'];

      override move(): void {}
      override scale(): void {}
    }
    class NotCoordinate extends Shape {
      static override readonly type = 'length';
      static override readonly params = Rect.params;
      static override readonly anchor: readonly [string, string] = ['width', 'y'];

      override move(): void {}
      override scale(): void {}
    }
    const factory = (await createShapeFactory());
    expect(() => factory.register(Missing)).toThrow('missing anchor cx must be a x coordinate');
    expect(() => factory.register(Swapped)).toThrow('swapped anchor y must be a x coordinate');
    expect(() => factory.register(NotCoordinate)).toThrow('length anchor width must be a x coordinate');
  });

  it('没有锚点的类型可正常注册', async () => {
    const factory = (await createShapeFactory());
    factory.register(Hexagon);
    expect(factory.has('hexagon')).toBe(true);
  });
});

describe('ShapeFactory 查询', () => {
  it('definition 提供只读静态规格，类型契约不暴露构造签名及内部查找', async () => {
    const factory = (await createShapeFactory());
    const definition = factory.definition('rect');
    expect(definition.type).toBe('rect');
    expect(definition.params).toEqual(Rect.params);
    expect(definition.paint).toBe('fill');
    expect(definition.attributes()).toEqual(Rect.attributes());
    expect(definition.attribute('width')).toBe(Rect.attribute('width'));
    expect(factory.definition('text').content).toBe('text');
    // 由 tsc 检查公开类型边界，不执行非法调用。
    if (false) {
      // @ts-expect-error definition 只提供规格，没有构造签名。
      new definition('r1');
      // @ts-expect-error 类型定义视图不可赋值。
      definition.type = 'changed';
      // @ts-expect-error 锚点属于注册校验信息，不是使用侧规格。
      definition.anchor;
      // @ts-expect-error 构造函数查找是工厂私有实现。
      factory.lookup('rect');
      // @ts-expect-error 不再提供返回构造函数的 find 接口。
      factory.find('rect');
    }
  });

  it('has 判断已注册及未知类型，不抛错', async () => {
    const factory = (await createShapeFactory());
    expect(factory.has('rect')).toBe(true);
    expect(factory.has('path')).toBe(false);
  });
});
