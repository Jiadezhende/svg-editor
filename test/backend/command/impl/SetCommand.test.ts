import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/commands/CreateCommand';
import SetCommand from '../../../../plugins/commands/SetCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

async function workspaceWith(...lines: string[][]): Promise<Workspace> {
  const workspace = (await createWorkspace());
  workspace.replace(new Document(800, 600));
  for (const args of lines) {
    new CreateCommand(workspace, args).execute();
  }
  return workspace;
}

function set(workspace: Workspace, ...args: string[]): string[] {
  return [...new SetCommand(workspace, args).execute().lines()];
}

function detailsOf(workspace: Workspace, id: string): string[] {
  return workspace.document().requireNode(id).value.details();
}

describe('SetCommand', () => {
  it('修改 text 内容：回显加引号；undo 回显旧值', async () => {
    const workspace = (await workspaceWith(['text', 'title', '20', '40', 'My Diagram']));
    const command = new SetCommand(workspace, ['title', 'text', 'My Diagram v2']);
    expect(command.execute().lines()).toEqual(['text#title updated: text="My Diagram v2"']);
    expect(command.undo().lines()).toEqual(['text#title updated: text="My Diagram"']);
    expect(workspace.document().requireNode('title').value.value('text')).toBe('My Diagram');
  });

  it('设置原本未设置的属性；undo 后恢复为未设置', async () => {
    const workspace = (await workspaceWith(['rect', 'r1', '0', '0', '10', '10']));
    const command = new SetCommand(workspace, ['r1', 'fill', 'red']);
    expect(command.execute().lines()).toEqual(['rect#r1 updated: fill=red']);
    expect(command.undo().lines()).toEqual(['rect#r1 updated: fill unset']);
    expect(detailsOf(workspace, 'r1')).toEqual(['x=0 y=0 width=10 height=10']);
  });

  it('几何属性按数值格式回显', async () => {
    const workspace = (await workspaceWith(['circle', 'c1', '0', '0', '1']));
    expect(set(workspace, 'c1', 'r', '2.50')).toEqual(['circle#c1 updated: r=2.5']);
  });

  it('容器只接受外观属性，写在容器自身', async () => {
    const workspace = (await workspaceWith(['g', 'g1'], ['rect', 'r1', '0', '0', '1', '1', 'in', 'g1']));
    expect(set(workspace, 'g1', 'stroke-width', '3')).toEqual(['g#g1 updated: stroke-width=3']);
    expect(detailsOf(workspace, 'g1')).toEqual(['', 'stroke-width=3']);
    expect(detailsOf(workspace, 'r1')).toEqual(['x=0 y=0 width=1 height=1']);
    expect(() => set(workspace, 'g1', 'x', '1')).toThrow(new EditorError('unknown attribute: x'));
  });

  it.each([
    ['circle', ['circle', 'c1', '0', '0', '1'], 'c1', 'width'],
    ['rect', ['rect', 'r1', '0', '0', '1', '1'], 'r1', 'text'],
    ['line', ['line', 'l1', '0', '0', '1', '1'], 'l1', 'x'],
    ['text', ['text', 't1', '0', '0', 'a'], 't1', 'r'],
  ])('%s 不接受属性表外的属性', async (_type, create, id, attribute) => {
    await expect(async () => set((await workspaceWith(create)), id, attribute, '10')).rejects.toThrow(new EditorError(`unknown attribute: ${attribute}`));
  });

  it('取值校验：几何须为数字，尺寸与 stroke-width 不得为负，颜色不校验；失败时属性不变', async () => {
    const workspace = (await workspaceWith(['rect', 'r1', '0', '0', '10', '10']));
    expect(() => set(workspace, 'r1', 'x', 'abc')).toThrow('not a number: abc');
    expect(() => set(workspace, 'r1', 'width', '-1')).toThrow('width must be non-negative');
    expect(() => set(workspace, 'r1', 'stroke-width', '-1')).toThrow('stroke-width must be non-negative');
    expect(set(workspace, 'r1', 'stroke', 'not-a-color')).toEqual(['rect#r1 updated: stroke=not-a-color']);
    expect(detailsOf(workspace, 'r1')).toEqual(['x=0 y=0 width=10 height=10', 'stroke=not-a-color']);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const workspace = (await workspaceWith(['rect', 'r1', '0', '0', '10', '10']));
    const command = new SetCommand(workspace, ['r1', 'fill', 'red']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
  });

  it('id 不存在时报错', async () => {
    await expect(async () => set((await workspaceWith()), 'r9', 'fill', 'red')).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数在构造时校验', async () => {
    await expect(async () => new SetCommand((await createWorkspace()), ['r1', 'fill'])).rejects.toThrow('wrong number of arguments. usage: set <id> <attr> <value>');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => set((await createWorkspace()), 'r1', 'fill', 'red')).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new SetCommand((await createWorkspace()), ['r1', 'fill', 'red']).undo()).rejects.toThrow('undo before execute');
  });
});
