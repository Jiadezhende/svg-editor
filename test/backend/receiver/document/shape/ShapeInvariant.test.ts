import { describe, expect, it } from 'vitest';
import Rect from '../../../../../plugins/core/Rect';
import Group from '../../../../../plugins/core/Group';
import Document from '../../../../../src/backend/receiver/document/Document';

const geometry = new Map<string, number | string>([['x', 1], ['y', 2], ['width', 3], ['height', 4]]);

describe('Shape 自身不变量', () => {
  it('构造允许必填属性暂缺，validate 报告缺失；非法值仍在构造时拒绝', () => {
    expect(() => new Rect('r').validate()).toThrow('missing attribute: x');
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

  it('变换溢出由属性规则在写入时拒绝，模型不再自行回滚', () => {
    const shape = new Rect('r', new Map(geometry).set('height', Number.MAX_VALUE));
    expect(() => shape.scale(2)).toThrow('height must be a finite number');
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
    expect(bNode.parent()).toBe(innerNode);
  });

  it('缩放系数不做模型级校验：0 得到 0 尺寸，负值与非法值由属性规则拒绝', () => {
    const zero = new Rect('r', geometry);
    zero.scale(0);
    expect(zero.value('width')).toBe(0);
    expect(zero.value('height')).toBe(0);
    expect(() => new Rect('r', geometry).scale(-1)).toThrow('width must be non-negative');
    expect(() => new Rect('r', geometry).scale(NaN)).toThrow('x must be a finite number');
    expect(() => new Rect('r', geometry).scale(Infinity)).toThrow('x must be a finite number');
  });

  it('平移的非法偏移由坐标规则在写入时拒绝，模型不再自行回滚', () => {
    const shape = new Rect('r', new Map(geometry).set('y', Number.MAX_VALUE));
    expect(() => shape.move(1, NaN)).toThrow('y must be a finite number');
    expect(() => shape.move(1, Number.MAX_VALUE)).toThrow('y must be a finite number');
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
