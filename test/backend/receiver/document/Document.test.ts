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

describe('Document 画布根', () => {
  it('label 为 svg，新建时没有图形', () => {
    const doc = new Document(800, 600);
    expect(doc.label()).toBe('svg');
    expect(doc.children()).toEqual([]);
  });

  it('add 追加到给定父节点末尾：顶层图形的父节点为 Document', () => {
    const doc = new Document(800, 600);
    const group = new Group('g1');
    const [r1, r2] = [rect('r1'), rect('r2')];
    doc.add(r1, doc);
    doc.add(group, doc);
    doc.add(r2, group);
    expect(doc.children()).toEqual([r1, group]);
    expect(r1.parent()).toBe(doc);
    expect(group.children()).toEqual([r2]);
  });

  it('id 全文档唯一（含容器内的子孙）；失败时文档不变', () => {
    const doc = new Document(800, 600);
    const group = new Group('g1');
    doc.add(group, doc);
    doc.add(rect('r1'), group);
    expect(() => doc.add(rect('r1'), doc)).toThrow(new EditorError('id already exists: r1'));
    expect(() => doc.add(rect('g1'), group)).toThrow('id already exists: g1');
    expect(doc.children()).toEqual([group]);
    expect(group.children()).toHaveLength(1);
  });

  it('id 大小写敏感', () => {
    const doc = new Document(800, 600);
    doc.add(rect('r1'), doc);
    expect(() => doc.add(rect('R1'), doc)).not.toThrow();
  });

  it('requireShape 在整棵树中查找，不存在时报错', () => {
    const doc = new Document(800, 600);
    const group = new Group('g1');
    const r1 = rect('r1');
    doc.add(group, doc);
    doc.add(r1, group);
    expect(doc.requireShape('r1')).toBe(r1);
    expect(() => doc.requireShape('r9')).toThrow(new EditorError('no such shape: r9'));
  });

  it('requireContainer：容器返回自身，不存在或不是容器时分别报错', () => {
    const doc = new Document(800, 600);
    const group = new Group('g1');
    doc.add(group, doc);
    doc.add(rect('r1'), doc);
    expect(doc.requireContainer('g1')).toBe(group);
    expect(() => doc.requireContainer('node9')).toThrow(new EditorError('no such container: node9'));
    expect(() => doc.requireContainer('r1')).toThrow(new EditorError('not a container: r1'));
  });

  it('remove 返回原位置，insert 可插回原位置', () => {
    const doc = new Document(800, 600);
    const [a, b, c] = [rect('a'), rect('b'), rect('c')];
    for (const shape of [a, b, c]) doc.add(shape, doc);
    expect(doc.remove(b)).toBe(1);
    expect(doc.find('b')).toBeNull();
    doc.insert(b, 1);
    expect(doc.children()).toEqual([a, b, c]);
  });
});
