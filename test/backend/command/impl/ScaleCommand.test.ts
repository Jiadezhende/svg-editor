import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import ScaleCommand from '../../../../plugins/core/ScaleCommand';
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

function detailsOf(workspace: Workspace, id: string): string[] {
  return workspace.document().requireNode(id).value.details();
}

describe('ScaleCommand', () => {
  it('叶子：位置与尺寸同乘，stroke-width 不缩放；undo 还原', async () => {
    const workspace = (await workspaceWith(['circle', 'c1', '100', '100', '20', 'red']));
    workspace.document().requireNode('c1').value.set('stroke-width', '2');
    const command = new ScaleCommand(workspace, ['c1', '2']);
    expect(command.execute().lines()).toEqual(['circle#c1 scaled by 2']);
    expect(detailsOf(workspace, 'c1')).toEqual(['cx=200 cy=200 r=40', 'fill=red stroke-width=2']);
    expect(command.undo().lines()).toEqual(['circle#c1 scaled back by 0.5']);
    expect(detailsOf(workspace, 'c1')).toEqual(['cx=100 cy=100 r=20', 'fill=red stroke-width=2']);
  });

  it('容器：所有子孙的位置与尺寸均乘以 factor', async () => {
    const workspace = (await workspaceWith(
      ['g', 'g1'],
      ['rect', 'r1', '10', '20', '30', '40', 'in', 'g1'],
      ['g', 'g2', 'in', 'g1'],
      ['line', 'l1', '1', '2', '3', '4', 'in', 'g2'],
    ));
    expect(new ScaleCommand(workspace, ['g1', '2']).execute().lines()).toEqual(['g#g1 scaled by 2']);
    expect(detailsOf(workspace, 'r1')).toEqual(['x=20 y=40 width=60 height=80']);
    expect(detailsOf(workspace, 'l1')).toEqual(['x1=2 y1=4 x2=6 y2=8']);
  });

  it('undo 精确还原（不依赖浮点反向运算）', async () => {
    const workspace = (await workspaceWith(['rect', 'r1', '0.1', '0.7', '1', '1']));
    const command = new ScaleCommand(workspace, ['r1', '3']);
    command.execute();
    expect(command.undo().lines()).toEqual(['rect#r1 scaled back by 0.333333']);
    expect(workspace.document().requireNode('r1').value.value('x')).toBe(0.1);
    expect(workspace.document().requireNode('r1').value.value('y')).toBe(0.7);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const workspace = (await workspaceWith(['rect', 'r1', '1', '1', '1', '1']));
    const command = new ScaleCommand(workspace, ['r1', '1.5']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
  });

  it.each(['0', '-1'])('factor 为 %s 时报错', async (factor) => {
    await expect(async () => new ScaleCommand((await createWorkspace()), ['r1', factor])).rejects.toThrow(new EditorError('scale factor must be positive'));
  });

  it('参数个数与数字在构造时校验', async () => {
    await expect(async () => new ScaleCommand((await createWorkspace()), ['r1'])).rejects.toThrow('wrong number of arguments. usage: scale <id> <factor>');
    await expect(async () => new ScaleCommand((await createWorkspace()), ['r1', 'x'])).rejects.toThrow('not a number: x');
  });

  it('id 不存在时报错', async () => {
    await expect(async () => new ScaleCommand((await workspaceWith()), ['r9', '2']).execute()).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new ScaleCommand((await createWorkspace()), ['r1', '2']).undo()).rejects.toThrow('undo before execute');
  });
});
