import { describe, expect, it } from 'vitest';
import ChildList from '../../../../src/backend/receiver/document/ChildList';
import Document from '../../../../src/backend/receiver/document/Document';
import Group from '../../../../src/backend/receiver/document/shape/Group';

describe('ChildList 子节点序列', () => {
  it('插入时同步父节点为所属节点，按位置维护顺序', () => {
    const owner = new Document(800, 600);
    const list = new ChildList(owner);
    const [a, b, c] = [new Group('a'), new Group('b'), new Group('c')];
    list.insert(a);
    list.insert(b);
    list.insert(c, 0);
    expect(list.all()).toEqual([c, a, b]);
    expect(c.parent()).toBe(owner);
  });

  it('摘除时返回原位置并解除父节点', () => {
    const list = new ChildList(new Document(800, 600));
    const [a, b] = [new Group('a'), new Group('b')];
    list.insert(a);
    list.insert(b);
    expect(list.remove(a)).toBe(0);
    expect(list.all()).toEqual([b]);
    expect(() => a.parent()).toThrow(Error);
  });

  it('摘除不在序列中的图形属于程序缺陷', () => {
    const list = new ChildList(new Document(800, 600));
    expect(() => list.remove(new Group('a'))).toThrow(Error);
  });

  it('find 在各子图形的子树中查找', () => {
    const list = new ChildList(new Document(800, 600));
    const outer = new Group('outer');
    const inner = new Group('inner');
    outer.insert(inner);
    list.insert(new Group('first'));
    list.insert(outer);
    expect(list.find('inner')).toBe(inner);
    expect(list.find('none')).toBeNull();
  });
});
