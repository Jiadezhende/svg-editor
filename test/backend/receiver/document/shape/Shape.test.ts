import { describe, expect, it } from 'vitest';
import Rect from '../../../../../src/backend/receiver/document/shape/Rect';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import EditorError from '../../../../../src/backend/error/EditorError';

const geometry = new Map<string, number | string>([
  ['x', 10],
  ['y', 20],
  ['width', 100],
  ['height', 50],
]);

// Shape 是抽象类，经叶子 Rect 验证其通用行为。
describe('Shape 通用行为', () => {
  it('记录 id 与类型，label 为 <type>#<id>', () => {
    const rect = new Rect('r1', geometry);
    expect(rect.id()).toBe('r1');
    expect(rect.type()).toBe('rect');
    expect(rect.label()).toBe('rect#r1');
  });

  it.each(['r1', 'start-label', '_a', 'A.b_c-1', 'R1'])('id %j 合法', (id) => {
    expect(new Rect(id, geometry).id()).toBe(id);
  });

  it.each(['1abc', '-a', '.a', 'a b', 'a#b', '中文', ''])('id %j 不合法时报错', (id) => {
    expect(() => new Rect(id, geometry)).toThrow(new EditorError(`invalid id: ${id}`));
  });

  it('属性值违反属性种类的约束时报错', () => {
    const negative = new Map(geometry).set('height', -1);
    expect(() => new Rect('r1', negative)).toThrow('height must be non-negative');
  });

  it('属性表外的属性属于程序缺陷，不是 EditorError', () => {
    const bad = new Map(geometry).set('r', 1);
    expect(() => new Rect('r1', bad)).toThrow(Error);
    expect(() => new Rect('r1', bad)).not.toThrow(EditorError);
  });

  it('属性表为必填参数加外观属性', () => {
    expect(Rect.attributes().map((spec) => spec.name())).toEqual([
      'x',
      'y',
      'width',
      'height',
      'fill',
      'stroke',
      'stroke-width',
    ]);
  });

  it('summary 只给出核心属性（必填参数），不含外观属性', () => {
    const rect = new Rect('r1', new Map(geometry).set('fill', '#eee'));
    expect(rect.summary()).toBe('x=10 y=20 width=100 height=50');
  });

  it('details：核心属性行，外观属性按属性表顺序列在第二行；未设置外观属性时只有一行', () => {
    expect(new Rect('r1', geometry).details()).toEqual(['x=10 y=20 width=100 height=50']);
    const styled = new Map(geometry).set('stroke-width', 2.5).set('fill', 'red').set('stroke', 'black');
    expect(new Rect('r1', styled).details()).toEqual([
      'x=10 y=20 width=100 height=50',
      'fill=red stroke=black stroke-width=2.5',
    ]);
  });

  it('数值按数值格式输出', () => {
    const rect = new Rect('r1', new Map(geometry).set('x', 0.1 + 0.2).set('y', -0));
    expect(rect.summary()).toBe('x=0.3 y=0 width=100 height=50');
  });

  it('attribute 按名字查属性表，没有时返回 null', () => {
    expect(Rect.attribute('fill')?.name()).toBe('fill');
    expect(Rect.attribute('r')).toBeNull();
  });

  it('叶子的 find 只比对自身，不是容器', () => {
    const rect = new Rect('r1', geometry);
    expect(rect.find('r1')).toBe(rect);
    expect(rect.find('R1')).toBeNull();
    expect(rect.asContainer()).toBeNull();
  });

  it('未加入容器时取父节点属于程序缺陷；加入后为该容器', () => {
    const rect = new Rect('r1', geometry);
    expect(() => rect.parent()).toThrow(Error);
    const group = new Group('g1');
    group.insert(rect);
    expect(rect.parent()).toBe(group);
  });

  it('已有父节点时再次插入属于程序缺陷', () => {
    const rect = new Rect('r1', geometry);
    new Group('g1').insert(rect);
    expect(() => new Group('g2').insert(rect)).toThrow(Error);
  });
});
