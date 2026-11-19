import { describe, expect, it } from 'vitest';
import { Shape, ShapeFactory, CoordinateSpec, Document } from '../../src/backend';
import type { ShapeNode } from '../../src/backend';
// @ts-expect-error 注册用类型是工厂内部实现，不从公共入口导出。
import type { ShapeClass } from '../../src/backend';
// @ts-expect-error 也不能从实现模块单独导入内部注册类型。
import type { ShapeClass as InternalShapeClass } from '../../src/backend/receiver/document/shape/ShapeFactory';

class Marker extends Shape {
  static override readonly type = 'test-marker';
  static override readonly params = [new CoordinateSpec('x', 'x'), new CoordinateSpec('y', 'y')];
}

describe('扩展公共入口', () => {
  it('仅用公共契约定义图形、注册、创建和读取节点，保留原模型引用', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const model = factory.create('test-marker', 'marker', new Map([['x', 1], ['y', 2]]));
    const doc = new Document(100, 100);
    const node = doc.insert(model);
    expect(doc.requireNode('marker')).toBe(node);
    expect(node.value).toBe(model);
    expect(node.value).toBeInstanceOf(Marker);
    expect(doc.findNode('missing')).toBeNull();
    expect(() => doc.requireNode('missing')).toThrow('no such shape: missing');
    expect(node.children()).toEqual([]);
    if (false) {
      // @ts-expect-error ShapeNode 只作为只读类型导出，不开放构造入口。
      new ShapeNode(model, () => ({ parent: null, children: [] }));
      // @ts-expect-error 不再提供返回模型的重复查找入口。
      doc.requireShape('marker');
      // @ts-expect-error 不公开内部插入预检查。
      doc.checkInsert(model);
    }
  });
});
