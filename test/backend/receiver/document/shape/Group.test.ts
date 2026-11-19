import { describe, expect, it } from 'vitest';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import Circle from '../../../../../src/backend/receiver/document/shape/Circle';
import Document from '../../../../../src/backend/receiver/document/Document';

const circle = (id: string) => new Circle(id, new Map([['cx', 0], ['cy', 0], ['r', 1]]));

describe('Group 模型与文档分组', () => {
  it('声明 g 类型及接收能力，模型不保存成员数或节点关系', () => {
    const group = new Group('g', new Map([['fill', 'red']]));
    expect(group.label()).toBe('g#g');
    expect(Group.params).toEqual([]);
    expect(Group.paint).toBeNull();
    expect(group.acceptsChildren()).toBe(true);
    expect(group.summary()).toBe('');
    expect(group.details()).toEqual(['', 'fill=red']);
    expect('children' in group).toBe(false);
  });

  it('文档组织多层分组变换，每个图形只处理一次；属性快照恢复整个子树', () => {
    const doc = new Document(100, 100);
    const outer = doc.insert(new Group('outer', new Map([['fill', 'red']])));
    const a = doc.insert(circle('a'), outer);
    const inner = doc.insert(new Group('inner'), outer);
    const b = doc.insert(circle('b'), inner);
    const saved = doc.capture(outer);
    doc.move(outer, 10, -5);
    expect(a.value.summary()).toBe('cx=10 cy=-5 r=1');
    expect(b.value.summary()).toBe('cx=10 cy=-5 r=1');
    doc.scale(outer, 2);
    expect(b.value.summary()).toBe('cx=20 cy=-10 r=2');
    outer.value.set('fill', 'blue');
    saved.restore();
    expect([a.value.value('cx'), b.value.value('cy'), outer.value.value('fill')]).toEqual([0, 0, 'red']);
  });

  it('直接修改分组模型只作用于自身，不遍历文档节点', () => {
    const doc = new Document(100, 100);
    const outer = doc.insert(new Group('outer'));
    const a = doc.insert(circle('a'), outer);
    outer.value.move(10, 20);
    outer.value.scale(3);
    outer.value.set('stroke', 'black');
    expect(a.value.summary()).toBe('cx=0 cy=0 r=1');
    expect(a.value.display('stroke')).toBeNull();
    expect(() => outer.value.set('x', '1')).toThrow('unknown attribute: x');
  });
});
