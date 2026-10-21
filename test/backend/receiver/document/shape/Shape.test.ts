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

  it('value 取原值：数值为 number，未设置的属性为 null', () => {
    const rect = new Rect('r1', new Map(geometry).set('x', 0.1 + 0.2).set('fill', '#eee'));
    expect(rect.value('x')).toBe(0.1 + 0.2);
    expect(rect.value('fill')).toBe('#eee');
    expect(rect.value('stroke')).toBeNull();
    expect(rect.value('r')).toBeNull();
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

describe('Shape 属性设置', () => {
  it('set 解析并写入属性表内的属性，可新增外观属性', () => {
    const rect = new Rect('r1', geometry);
    rect.set('width', '120.5');
    rect.set('fill', 'red');
    expect(rect.value('width')).toBe(120.5);
    expect(rect.display('fill')).toBe('red');
  });

  it('属性不在本类属性表中时报 unknown attribute，属性不变', () => {
    const rect = new Rect('r1', geometry);
    expect(() => rect.set('r', '10')).toThrow(new EditorError('unknown attribute: r'));
    expect(() => rect.set('text', 'x')).toThrow('unknown attribute: text');
    expect(rect.value('r')).toBeNull();
  });

  it('取值格式或约束不满足时报错，属性不变', () => {
    const rect = new Rect('r1', geometry);
    expect(() => rect.set('x', 'abc')).toThrow('not a number: abc');
    expect(() => rect.set('height', '-1')).toThrow('height must be non-negative');
    expect(() => rect.set('stroke-width', '-2')).toThrow('stroke-width must be non-negative');
    expect(rect.summary()).toBe('x=10 y=20 width=100 height=50');
  });

  it('display 给出属性值的展示文本，未设置时为 null', () => {
    const rect = new Rect('r1', geometry);
    expect(rect.display('x')).toBe('10');
    expect(rect.display('fill')).toBeNull();
  });
});

describe('Shape 平移与缩放', () => {
  it('move 只平移坐标，尺寸与外观不变', () => {
    const rect = new Rect('r1', new Map(geometry).set('stroke-width', 2));
    rect.move(-10, 0.5);
    expect(rect.details()).toEqual(['x=0 y=20.5 width=100 height=50', 'stroke-width=2']);
  });

  it('scale 以原点为中心同乘坐标与尺寸，stroke-width 不缩放', () => {
    const rect = new Rect('r1', new Map(geometry).set('stroke-width', 2));
    rect.scale(2);
    expect(rect.details()).toEqual(['x=20 y=40 width=200 height=100', 'stroke-width=2']);
  });

  it('position 按 anchor 给出锚点坐标', () => {
    const rect = new Rect('r1', geometry);
    rect.move(30, 0);
    expect(rect.position()).toEqual(['40', '20']);
    expect(new Group('g1').position()).toBeNull();
  });
});

describe('Shape 快照', () => {
  it('restore 写回快照时的属性：被修改的还原，后来新增的移除', () => {
    const rect = new Rect('r1', geometry);
    const memento = rect.capture();
    rect.move(0.1, 0.2);
    rect.scale(3);
    rect.set('fill', 'red');
    memento.restore();
    expect(rect.value('x')).toBe(10);
    expect(rect.value('y')).toBe(20);
    expect(rect.value('fill')).toBeNull();
  });

  it('快照之后可多次恢复', () => {
    const rect = new Rect('r1', geometry);
    const memento = rect.capture();
    rect.move(1, 1);
    memento.restore();
    rect.move(2, 2);
    memento.restore();
    expect(rect.position()).toEqual(['10', '20']);
  });
});

describe('Shape 移动位置', () => {
  it('relocate：未加入容器时直接插入；已在容器中时先摘下再插入', () => {
    const rect = new Rect('r1', geometry);
    const [g1, g2] = [new Group('g1'), new Group('g2')];
    rect.relocate(g1);
    expect(rect.parent()).toBe(g1);
    rect.relocate(g2);
    expect(g1.children()).toEqual([]);
    expect(g2.children()).toEqual([rect]);
  });

  it('relocate 到同一父节点的指定位置', () => {
    const group = new Group('g');
    const [a, b, c] = [new Rect('a', geometry), new Rect('b', geometry), new Rect('c', geometry)];
    for (const shape of [a, b, c]) shape.relocate(group);
    a.relocate(group);
    expect(group.children()).toEqual([b, c, a]);
    a.relocate(group, 0);
    expect(group.children()).toEqual([a, b, c]);
  });
});
