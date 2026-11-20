import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/commands/CreateCommand';
import TreeCommand from '../../../../plugins/commands/TreeCommand';
import UngroupCommand from '../../../../plugins/commands/UngroupCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

/** 根下为 scene{a, inner{b, c}, d}、e。 */
async function sample(): Promise<Workspace> {
  const workspace = (await createWorkspace());
  workspace.replace(new Document(800, 600));
  for (const line of [
    'g scene',
    'rect a 0 0 1 1 in scene',
    'g inner in scene',
    'rect b 0 0 1 1 in inner',
    'rect c 0 0 1 1 in inner',
    'rect d 0 0 1 1 in scene',
    'rect e 0 0 1 1',
  ]) {
    new CreateCommand(workspace, line.split(' ')).execute();
  }
  return workspace;
}

function ids(workspace: Workspace, containerId: string): string[] {
  return workspace.document().requireNode(containerId).children().map((shape) => shape.value.id());
}

function tree(workspace: Workspace): string[] {
  return [...new TreeCommand(workspace, []).execute().lines()];
}

describe('UngroupCommand', () => {
  it('子图形按原顺序提升到父级，占据容器原来的位置', async () => {
    const workspace = (await sample());
    expect(new UngroupCommand(workspace, ['inner']).execute().lines()).toEqual([
      'g#inner ungrouped, 2 children moved to g#scene',
    ]);
    expect(ids(workspace, 'scene')).toEqual(['a', 'b', 'c', 'd']);
    expect(workspace.document().findNode('inner')).toBeNull();
  });

  it('undo 还原容器及其子图形的原位置与顺序', async () => {
    const workspace = (await sample());
    const before = tree(workspace);
    const command = new UngroupCommand(workspace, ['inner']);
    command.execute();
    expect(command.undo().lines()).toEqual(['g#inner restored into g#scene with 2 children']);
    expect(tree(workspace)).toEqual(before);
  });

  it('空容器解散后直接消失', async () => {
    const workspace = (await sample());
    new CreateCommand(workspace, 'g empty in scene'.split(' ')).execute();
    expect(new UngroupCommand(workspace, ['empty']).execute().lines()).toEqual([
      'g#empty ungrouped, 0 children moved to g#scene',
    ]);
    expect(ids(workspace, 'scene')).toEqual(['a', 'inner', 'd']);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const workspace = (await sample());
    const command = new UngroupCommand(workspace, ['inner']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(ids(workspace, 'scene')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('根级容器不可解散，文档不变', async () => {
    const workspace = (await sample());
    const before = tree(workspace);
    expect(() => new UngroupCommand(workspace, ['scene']).execute()).toThrow(
      new EditorError('cannot ungroup top-level container: scene'),
    );
    expect(tree(workspace)).toEqual(before);
  });

  it('目标不是容器 / 不存在时报错', async () => {
    const workspace = (await sample());
    expect(() => new UngroupCommand(workspace, ['e']).execute()).toThrow(new EditorError('not a container: e'));
    expect(() => new UngroupCommand(workspace, ['g9']).execute()).toThrow(new EditorError('no such shape: g9'));
  });

  it('参数个数在构造时校验；无文档时报无文档', async () => {
    await expect(async () => new UngroupCommand((await createWorkspace()), [])).rejects.toThrow('wrong number of arguments. usage: ungroup <gid>');
    await expect(async () => new UngroupCommand((await createWorkspace()), ['g1']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new UngroupCommand((await sample()), ['inner']).undo()).rejects.toThrow('undo before execute');
  });
});
