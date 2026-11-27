import { describe, expect, it } from 'vitest';
import ShapeMemento from '../../../../../src/backend/receiver/document/shape/ShapeMemento';

describe('ShapeMemento', () => {
  it('restore 依次执行全部恢复动作', () => {
    const calls: string[] = [];
    new ShapeMemento([() => calls.push('a'), () => calls.push('b')]).restore();
    expect(calls).toEqual(['a', 'b']);
  });

  it('with 合并多个快照，自身在前', () => {
    const calls: string[] = [];
    const own = new ShapeMemento([() => calls.push('own')]);
    const merged = own.with([new ShapeMemento([() => calls.push('c1')]), new ShapeMemento([() => calls.push('c2')])]);
    merged.restore();
    expect(calls).toEqual(['own', 'c1', 'c2']);
  });
});
