import { describe, expect, it } from 'vitest';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import Circle from '../../../../../src/backend/receiver/document/shape/Circle';

function circle(id: string): Circle {
  return new Circle(id, new Map([['cx', 0], ['cy', 0], ['r', 1]]));
}

describe('Group 容器', () => {
  it('类型为 g，没有必填参数与可选外观参数', () => {
    const group = new Group('scene');
    expect(group.label()).toBe('g#scene');
    expect(Group.params).toEqual([]);
    expect(Group.paint).toBeNull();
  });

  it('tree 中不内联属性；show 的核心属性行为子节点个数，外观属性照常列出', () => {
    const group = new Group('g1', new Map([['fill', 'red']]));
    expect(group.summary()).toBe('');
    expect(group.details()).toEqual(['children=0', 'fill=red']);
    group.insert(circle('a'));
    group.insert(circle('b'));
    expect(group.details()).toEqual(['children=2', 'fill=red']);
  });

  it('是容器：asContainer 返回自身', () => {
    const group = new Group('g1');
    expect(group.asContainer()).toBe(group);
  });

  it('insert 默认追加到末尾，可指定位置；子图形的父节点为本容器', () => {
    const group = new Group('g1');
    const [a, b, c] = [circle('a'), circle('b'), circle('c')];
    group.insert(a);
    group.insert(c);
    group.insert(b, 1);
    expect(group.children()).toEqual([a, b, c]);
    expect(b.parent()).toBe(group);
  });

  it('remove 返回原位置，被摘除的图形不再有父节点', () => {
    const group = new Group('g1');
    const [a, b] = [circle('a'), circle('b')];
    group.insert(a);
    group.insert(b);
    expect(group.remove(b)).toBe(1);
    expect(group.children()).toEqual([a]);
    expect(() => b.parent()).toThrow(Error);
  });

  it('find 作用于整棵子树：自身、子图形、嵌套容器中的子孙', () => {
    const outer = new Group('outer');
    const inner = new Group('inner');
    const leaf = circle('leaf');
    outer.insert(inner);
    inner.insert(leaf);
    expect(outer.find('outer')).toBe(outer);
    expect(outer.find('inner')).toBe(inner);
    expect(outer.find('leaf')).toBe(leaf);
    expect(outer.find('none')).toBeNull();
  });
});

describe('Group 统一操作（Composite）', () => {
  function tree(): { outer: Group; inner: Group; a: Circle; b: Circle } {
    const outer = new Group('outer', new Map([['fill', 'red']]));
    const inner = new Group('inner');
    const [a, b] = [circle('a'), circle('b')];
    outer.insert(a);
    outer.insert(inner);
    inner.insert(b);
    return { outer, inner, a, b };
  }

  it('move 递归到每个子孙', () => {
    const { outer, a, b } = tree();
    outer.move(10, -5);
    expect(a.summary()).toBe('cx=10 cy=-5 r=1');
    expect(b.summary()).toBe('cx=10 cy=-5 r=1');
  });

  it('scale 递归到每个子孙，位置与尺寸同乘', () => {
    const { outer, b } = tree();
    outer.move(10, 10);
    outer.scale(2);
    expect(b.summary()).toBe('cx=20 cy=20 r=2');
  });

  it('set 只作用于容器自身，只接受外观属性', () => {
    const { outer, a } = tree();
    outer.set('stroke', 'black');
    expect(outer.details()).toEqual(['children=2', 'fill=red stroke=black']);
    expect(a.display('stroke')).toBeNull();
    expect(() => outer.set('x', '1')).toThrow('unknown attribute: x');
  });

  it('快照包含整棵子树，restore 后全部还原', () => {
    const { outer, a, b } = tree();
    const memento = outer.capture();
    outer.move(0.1, 0.2);
    outer.scale(3);
    outer.set('fill', 'blue');
    memento.restore();
    expect([a.value('cx'), b.value('cy'), outer.value('fill')]).toEqual([0, 0, 'red']);
  });
});
