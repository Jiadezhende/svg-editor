import { describe, expect, it } from 'vitest';
import Rect from '../../../../../src/backend/receiver/document/shape/Rect';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import Document from '../../../../../src/backend/receiver/document/Document';
import type { AttributeValue } from '../../../../../src/backend/receiver/document/attribute/AttributeSpec';

const geometry = new Map<string, AttributeValue>([['x', 1], ['y', 2], ['width', 3], ['height', 4]]);

describe('Shape 自身不变量', () => {
  it('直接构造也必须提供完整必填属性，不能只依靠命令校验', () => {
    expect(() => new Rect('r')).toThrow('missing attribute: x');
    expect(() => new Rect('r', new Map(geometry).set('width', -1))).toThrow('width must be non-negative');
  });

  it.each([NaN, Infinity, -Infinity, '1'])('拒绝直接传入非法数值 %s', (value) => {
    expect(() => new Rect('r', new Map(geometry).set('x', value))).toThrow('x must be a finite number');
    expect(() => new Rect('r', new Map(geometry).set('width', value))).toThrow('width must be a finite number');
    expect(() => new Rect('r', new Map(geometry).set('stroke-width', value))).toThrow('stroke-width must be a finite number');
  });

  it('字符串属性不接受数值', () => {
    expect(() => new Rect('r', new Map(geometry).set('fill', 123))).toThrow('fill must be a string');
  });

  it('变换后溢出，前面已计算的属性也不修改', () => {
    const shape = new Rect('r', new Map(geometry).set('height', Number.MAX_VALUE));
    const before = shape.entries();
    expect(() => shape.scale(2)).toThrow('height must be a finite number');
    expect(shape.entries()).toEqual(before);
  });

  it('容器后一个子节点变换失败，前面的子节点及容器状态恢复', () => {
    const outer = new Group('outer');
    const inner = new Group('inner');
    const a = new Rect('a', geometry);
    const b = new Rect('b', new Map(geometry).set('height', Number.MAX_VALUE));
    const doc = new Document(100, 100);
    const root = doc.insert(outer);
    doc.insert(a, root);
    const innerNode = doc.insert(inner, root);
    const bNode = doc.insert(b, innerNode);
    const before = [outer.entries(), a.entries(), b.entries()];
    expect(() => doc.scale(root, 2)).toThrow('height must be a finite number');
    expect([outer.entries(), a.entries(), b.entries()]).toEqual(before);
    expect(doc.parent(bNode)).toBe(innerNode);
  });

  it.each([0, -1, NaN, Infinity])('直接缩放拒绝非法系数 %s', (factor) => {
    const shape = new Rect('r', geometry);
    expect(() => shape.scale(factor)).toThrow('scale factor must be positive');
    expect(shape.entries()).toEqual(new Rect('r', geometry).entries());
  });

  it('直接平移拒绝非有限偏移及运算溢出，保持原值', () => {
    const shape = new Rect('r', new Map(geometry).set('y', Number.MAX_VALUE));
    const before = shape.entries();
    expect(() => shape.move(1, NaN)).toThrow('move offsets must be finite');
    expect(() => shape.move(1, Number.MAX_VALUE)).toThrow('y must be a finite number');
    expect(shape.entries()).toEqual(before);
  });

  it('画布和 viewBox 必须有限且尺寸有效，输入数组不保留可变引用', () => {
    expect(() => new Document(Infinity, 100)).toThrow('canvas size must be positive');
    expect(() => new Document(100, 100, [0, 0, -1, 10])).toThrow('invalid viewBox');
    expect(() => new Document(100, 100, [NaN, 0, 10, 10])).toThrow('invalid viewBox');
    const box: [number, number, number, number] = [0, 0, 10, 10];
    const doc = new Document(100, 100, box);
    box[2] = -1;
    expect(doc.viewBox()[2]).toBe(10);
    expect(() => doc.resize(100, Infinity)).toThrow('canvas size must be positive');
    expect(doc.height()).toBe(100);
  });
});
