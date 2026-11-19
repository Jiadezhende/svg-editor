import { describe, expect, it } from 'vitest';
import Document from '../../../../src/backend/receiver/document/Document';
import EditorError from '../../../../src/backend/error/EditorError';
import Group from '../../../../src/backend/receiver/document/shape/Group';
import Rect from '../../../../src/backend/receiver/document/shape/Rect';

function rect(id: string): Rect {
  return new Rect(id, new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]]));
}

describe('Document 画布', () => {
  it('新建时记录尺寸，viewBox 为 0 0 w h', () => {
    const doc = new Document(100.5, 200);
    expect([doc.width(), doc.height()]).toEqual([100.5, 200]);
    expect(doc.viewBox()).toEqual([0, 0, 100.5, 200]);
  });

  it('新建时可指定 viewBox', () => {
    expect(new Document(400, 300, [10, 20, 40, 30]).viewBox()).toEqual([10, 20, 40, 30]);
  });

  it('resize 修改尺寸，不改动 viewBox', () => {
    const doc = new Document(200, 100);
    doc.resize(400, 300);
    expect([doc.width(), doc.height()]).toEqual([400, 300]);
    expect(doc.viewBox()).toEqual([0, 0, 200, 100]);
  });

  it.each([
    [0, 600],
    [800, 0],
    [-1, 600],
    [800, -0.5],
  ])('新建时尺寸 %s x %s 非正数报错', (w, h) => {
    expect(() => new Document(w, h)).toThrow(new EditorError('canvas size must be positive'));
  });

  it.each([
    [0, 600],
    [800, -1],
  ])('resize 为 %s x %s 失败时尺寸不变', (w, h) => {
    const doc = new Document(800, 600);
    expect(() => doc.resize(w, h)).toThrow('canvas size must be positive');
    expect([doc.width(), doc.height()]).toEqual([800, 600]);
  });
});

describe('Document 节点树', () => {
  it('通用 insert 支持顶层、容器及指定位置，节点只包装原有 Shape', () => {
    const doc = new Document(100, 100);
    const group = new Group('g');
    const root = doc.insert(group);
    const a = doc.insert(rect('a'), root);
    const c = doc.insert(rect('c'), root);
    const b = doc.insert(rect('b'), root, 1);
    expect(doc.label()).toBe('svg');
    expect(root.value).toBe(group);
    expect(doc.parent(root)).toBeNull();
    expect(doc.children(root)).toEqual([a, b, c]);
    expect(root.children()).toEqual([a, b, c]);
    expect(b.parent()).toBe(root);
    expect(doc.indexOf(b)).toBe(1);
    expect('id' in b).toBe(false);
    expect('index' in b).toBe(false);
    expect(doc.requireShape('b')).toBe(b.value);
    expect(doc.requireNode('b')).toBe(b);
    expect(doc.requireChildTarget('g')).toBe(root);
    expect(doc.find('missing')).toBeNull();
    expect(doc.findNode('missing')).toBeNull();
    expect(() => doc.requireShape('missing')).toThrow('no such shape: missing');
    expect(() => doc.requireChildTarget('missing')).toThrow('no such container: missing');
    expect(() => doc.requireChildTarget('b')).toThrow('not a container: b');
  });

  it('先序遍历保留多层 Group，查找无需经过外层分组', () => {
    const doc = new Document(100, 100);
    doc.insert(rect('a'));
    const outer = doc.insert(new Group('outer'));
    doc.insert(rect('b'), outer);
    const inner = doc.insert(new Group('inner'), outer);
    const c = doc.insert(rect('c'), inner);
    doc.insert(rect('d'));
    expect(doc.shapes().map((s) => s.id())).toEqual(['a', 'outer', 'b', 'inner', 'c', 'd']);
    expect(doc.nodes(inner)).toEqual([inner, c]);
    expect(doc.requireShape('c')).toBe(c.value);
  });

  it('id 全文档唯一且大小写敏感；重复插入对象也被拒绝', () => {
    const doc = new Document(100, 100);
    const group = doc.insert(new Group('g'));
    const a = doc.insert(rect('a'), group);
    expect(() => doc.insert(rect('a'))).toThrow('id already exists: a');
    expect(() => doc.insert(rect('g'), group)).toThrow('id already exists: g');
    expect(() => doc.insert(a.value)).toThrow('shape already attached: a');
    expect(doc.children(group)).toEqual([a]);
    expect(() => doc.insert(rect('A'))).not.toThrow();
  });

  it('移除整个子树，结构快照恢复全部关系、顺序与对象身份', () => {
    const doc = new Document(100, 100);
    const left = doc.insert(rect('left'));
    const root = doc.insert(new Group('g'));
    const inner = doc.insert(new Group('inner'), root);
    const leaf = doc.insert(rect('leaf'), inner);
    const right = doc.insert(rect('right'));
    const saved = doc.captureStructure();
    expect(doc.remove(root)).toBe(1);
    expect(doc.children()).toEqual([left, right]);
    expect(doc.find('leaf')).toBeNull();
    expect(root.children()).toEqual([]);
    expect(leaf.parent()).toBeNull();
    saved.restore();
    expect(doc.children()).toEqual([left, root, right]);
    expect(doc.requireNode('leaf')).toBe(leaf);
    expect(doc.requireShape('leaf')).toBe(leaf.value);
    expect(doc.parent(leaf)).toBe(inner);
    expect(doc.children(root)).toEqual([inner]);
    doc.remove(leaf);
    saved.restore();
    expect(doc.requireNode('leaf')).toBe(leaf);
  });

  it('结构快照不回滚属性或画布，恢复时移除后来插入的节点', () => {
    const doc = new Document(100, 100);
    const a = doc.insert(rect('a'));
    const saved = doc.captureStructure();
    const extra = doc.insert(new Group('extra'));
    doc.relocate(a, extra);
    a.value.set('fill', 'red');
    doc.resize(200, 300);
    saved.restore();
    expect(doc.children()).toEqual([a]);
    expect(a.value.value('fill')).toBe('red');
    expect(doc.width()).toBe(200);
    expect(extra.children()).toEqual([]);
  });
});
