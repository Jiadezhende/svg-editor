import { describe, expect, it } from 'vitest';
import Document from '../../../../src/backend/receiver/document/Document';
import EditorError from '../../../../src/backend/error/EditorError';

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
