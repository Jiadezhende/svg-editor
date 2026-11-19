import { describe, expect, it } from 'vitest';
import Invoker from '../../../src/backend/invoker/Invoker';
import Workspace from '../../../src/backend/receiver/workspace/Workspace';
import Document from '../../../src/backend/receiver/document/Document';
import Group from '../../../src/backend/receiver/document/shape/Group';
import Rect from '../../../src/backend/receiver/document/shape/Rect';
import CreateCommand from '../../../src/backend/command/impl/CreateCommand';
import DeleteCommand from '../../../src/backend/command/impl/DeleteCommand';
import GroupCommand from '../../../src/backend/command/impl/GroupCommand';
import MoveCommand from '../../../src/backend/command/impl/MoveCommand';
import SetCommand from '../../../src/backend/command/impl/SetCommand';
import UndoRecord from '../../../src/backend/command/UndoRecord';
import CommandResult from '../../../src/backend/command/CommandResult';

function scene() {
  const workspace = new Workspace();
  const doc = new Document(100, 100);
  const group = doc.insert(new Group('g'));
  const child = doc.insert(new Rect('r', new Map([['x', 10], ['y', 20], ['width', 30], ['height', 40]])), group);
  workspace.replace(doc);
  return { workspace, doc, group, child, invoker: new Invoker() };
}

function contents(doc: Document) {
  return doc.nodes().map((node) => ({
    id: node.value.id(), parent: node.parent()?.value.id() ?? null, values: node.value.entries(),
  }));
}

describe('真实编辑命令的历史组合', () => {
  it('局部编辑失败恢复本次快照，并保留上一次成功的撤销记录', () => {
    const record = new UndoRecord();
    let value = 1;
    record.execute({ restore: () => { value = 1; } }, () => {
      value = 2;
      return { result: new CommandResult().line('edited'), undo: 'first undo' };
    });
    expect(() => record.execute({ restore: () => { value = 2; } }, () => {
      value = 3;
      throw new Error('failed');
    })).toThrow('failed');
    expect(value).toBe(2);
    expect(record.undo().lines()).toEqual(['first undo']);
    expect(value).toBe(1);
  });

  it('属性、变换和分组可多轮整体撤销与重做，不丢失原节点身份', () => {
    const { workspace, doc, group, child, invoker } = scene();
    const original = contents(doc);
    invoker.execute(new SetCommand(workspace, ['r', 'fill', 'red']));
    invoker.execute(new MoveCommand(workspace, ['g', '5', '10']));
    invoker.execute(new GroupCommand(workspace, ['outer', 'g']));
    const edited = contents(doc);
    for (let round = 0; round < 2; round += 1) {
      expect(invoker.undo().lines()).toEqual(['g#outer removed, 1 children restored']);
      expect(invoker.undo().lines()).toEqual(['g#g moved back by (-5,-10)']);
      expect(invoker.undo().lines()).toEqual(['rect#r updated: fill unset']);
      expect(contents(doc)).toEqual(original);
      expect(doc.requireNode('g')).toBe(group);
      expect(doc.requireNode('r')).toBe(child);
      invoker.redo();
      invoker.redo();
      expect(invoker.redo().lines()).toEqual(['g#outer created with 1 children']);
      expect(contents(doc)).toEqual(edited);
      expect(doc.requireNode('r')).toBe(child);
    }
  });

  it('失败的新编辑不清空 redo，重做遇到 id 冲突也可在冲突消除后重试', () => {
    const { workspace, doc, invoker } = scene();
    invoker.execute(new CreateCommand(workspace, ['g', 'new']));
    invoker.undo();
    expect(() => invoker.execute(new CreateCommand(workspace, ['g', 'g']))).toThrow('id already exists: g');
    const conflict = doc.insert(new Group('new'));
    expect(() => invoker.redo()).toThrow('id already exists: new');
    expect(doc.requireNode('new')).toBe(conflict);
    expect(() => invoker.undo()).toThrow('nothing to undo');
    doc.remove(conflict);
    expect(invoker.redo().lines()).toEqual(['g#new created']);
    expect(invoker.undo().lines()).toEqual(['g#new removed']);
    expect(doc.findNode('new')).toBeNull();
  });

  it('跨文档归属冲突使撤销失败，历史不转移，释放后恢复原节点与顺序', () => {
    const { workspace, doc, group, child, invoker } = scene();
    invoker.execute(new DeleteCommand(workspace, ['g']));
    const other = new Document(20, 20);
    const foreign = other.insert(child.value);
    expect(() => invoker.undo()).toThrow('shape already attached: r');
    expect(doc.children()).toEqual([]);
    expect(other.requireNode('r')).toBe(foreign);
    expect(() => invoker.redo()).toThrow('nothing to redo');
    other.remove(foreign);
    expect(invoker.undo().lines()).toEqual(['g#g restored into svg']);
    expect(doc.children()).toEqual([group]);
    expect(group.children()).toEqual([child]);
    expect(doc.requireNode('r')).toBe(child);
    invoker.redo();
    expect(doc.children()).toEqual([]);
  });
});
