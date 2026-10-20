import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import ShowCommand from '../../../../src/backend/command/impl/ShowCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

function workspaceWith(...lines: string[][]): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  for (const args of lines) {
    new CreateCommand(workspace, args).execute();
  }
  return workspace;
}

function show(workspace: Workspace, id: string): string[] {
  return [...new ShowCommand(workspace, [id]).execute().lines()];
}

describe('ShowCommand', () => {
  it('容器内的图形：首行父节点为容器，其后为核心属性行与外观属性行', () => {
    const workspace = workspaceWith(['g', 'markers'], ['circle', 'c1', '100', '100', '20', 'red', 'in', 'markers']);
    expect(show(workspace, 'c1')).toEqual(['circle#c1  parent=g#markers', '  cx=100 cy=100 r=20', '  fill=red']);
  });

  it('根级图形 parent=svg；未设置外观属性时省略外观行', () => {
    const workspace = workspaceWith(['line', 'l1', '0', '0', '100', '50']);
    expect(show(workspace, 'l1')).toEqual(['line#l1  parent=svg', '  x1=0 y1=0 x2=100 y2=50']);
  });

  it('text 的内容加双引号', () => {
    const workspace = workspaceWith(['text', 't1', '20', '40', 'My Diagram']);
    expect(show(workspace, 't1')).toEqual(['text#t1  parent=svg', '  x=20 y=40 text="My Diagram"']);
  });

  it('g 的核心属性行为子节点个数', () => {
    const workspace = workspaceWith(['g', 'g1'], ['rect', 'r1', '0', '0', '1', '1', 'in', 'g1'], ['g', 'g2', 'in', 'g1']);
    expect(show(workspace, 'g1')).toEqual(['g#g1  parent=svg', '  children=2']);
    expect(show(workspace, 'g2')).toEqual(['g#g2  parent=g#g1', '  children=0']);
  });

  it('id 不存在时报错', () => {
    expect(() => show(workspaceWith(), 'r9')).toThrow(new EditorError('no such shape: r9'));
  });

  it.each([[[]], [['a', 'b']]])('参数个数不符时报错并附语法：%j', (args) => {
    expect(() => new ShowCommand(new Workspace(), args)).toThrow('wrong number of arguments. usage: show <id>');
  });

  it('无文档时报无文档', () => {
    expect(() => show(new Workspace(), 'c1')).toThrow("no document. use 'init' or 'read' first");
  });
});
