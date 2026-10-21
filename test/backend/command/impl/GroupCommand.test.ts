import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import GroupCommand from '../../../../src/backend/command/impl/GroupCommand';
import TreeCommand from '../../../../src/backend/command/impl/TreeCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

function workspaceWith(...lines: string[]): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  for (const line of lines) {
    new CreateCommand(workspace, line.split(' ')).execute();
  }
  return workspace;
}

function tree(workspace: Workspace): string[] {
  return [...new TreeCommand(workspace, []).execute().lines()];
}

function group(workspace: Workspace, line: string): string[] {
  return [...new GroupCommand(workspace, line.split(' ')).execute().lines()];
}

const flat = ['rect bg 0 0 1 1', 'text title 0 0 t', 'circle c1 0 0 1', 'rect box 0 0 1 1'];

describe('GroupCommand', () => {
  it('收编根下的图形：新容器插在第一个成员的位置，成员按文档顺序排列', () => {
    const workspace = workspaceWith(...flat);
    expect(group(workspace, 'markers c1 box')).toEqual(['g#markers created with 2 children']);
    expect(tree(workspace)).toEqual([
      'svg (800x600)',
      '├── rect#bg  x=0 y=0 width=1 height=1',
      '├── text#title  x=0 y=0 text="t"',
      '└── g#markers',
      '    ├── circle#c1  cx=0 cy=0 r=1',
      '    └── rect#box  x=0 y=0 width=1 height=1',
    ]);
  });

  it('成员顺序取文档顺序，与参数顺序无关', () => {
    const workspace = workspaceWith(...flat);
    group(workspace, 'g1 box bg');
    expect(workspace.document().children().map((s) => s.id())).toEqual(['g1', 'title', 'c1']);
    expect(workspace.document().requireContainer('g1').children().map((s) => s.id())).toEqual(['bg', 'box']);
  });

  it('成员来自不同父容器：全部摘出，新容器插在文档顺序第一个成员的父容器中', () => {
    const workspace = workspaceWith('g a', 'rect r1 0 0 1 1 in a', 'rect r2 0 0 1 1 in a', 'g b', 'rect r3 0 0 1 1 in b');
    group(workspace, 'mix r3 r2');
    expect(tree(workspace)).toEqual([
      'svg (800x600)',
      '├── g#a',
      '│   ├── rect#r1  x=0 y=0 width=1 height=1',
      '│   └── g#mix',
      '│       ├── rect#r2  x=0 y=0 width=1 height=1',
      '│       └── rect#r3  x=0 y=0 width=1 height=1',
      '└── g#b',
    ]);
  });

  it('undo 一次还原全部成员的原父容器与原位置，新容器消失', () => {
    const workspace = workspaceWith('g a', 'rect r1 0 0 1 1 in a', 'rect r2 0 0 1 1 in a', 'g b', 'rect r3 0 0 1 1 in b', 'circle c 0 0 1');
    const before = tree(workspace);
    const command = new GroupCommand(workspace, 'mix c r1 r3'.split(' '));
    command.execute();
    expect(command.undo().lines()).toEqual(['g#mix removed, 3 children restored']);
    expect(tree(workspace)).toEqual(before);
    expect(workspace.document().find('mix')).toBeNull();
  });

  it('undo 后再次 execute（redo）回显与首次相同，结构相同', () => {
    const workspace = workspaceWith(...flat);
    const command = new GroupCommand(workspace, 'markers c1 box'.split(' '));
    const first = command.execute().lines();
    const after = tree(workspace);
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(tree(workspace)).toEqual(after);
  });

  it('可以收编容器，容器连同子树移动', () => {
    const workspace = workspaceWith('g inner', 'rect r1 0 0 1 1 in inner', 'rect r2 0 0 1 1');
    group(workspace, 'outer inner r2');
    expect(workspace.document().requireShape('r1').parent()).toBe(workspace.document().requireShape('inner'));
    expect(workspace.document().requireShape('inner').parent()).toBe(workspace.document().requireShape('outer'));
  });

  it('成员中有容器与其子孙时报错，文档不变', () => {
    const workspace = workspaceWith('g markers', 'circle c1 0 0 1 in markers');
    const before = tree(workspace);
    expect(() => group(workspace, 'bad c1 markers')).toThrow(
      new EditorError('cannot group a container into its own descendant: markers'),
    );
    expect(tree(workspace)).toEqual(before);
  });

  it('newGid 已存在 / 不合法时报错，文档不变', () => {
    const workspace = workspaceWith(...flat);
    expect(() => group(workspace, 'bg c1')).toThrow(new EditorError('id already exists: bg'));
    expect(() => group(workspace, '1abc c1')).toThrow(new EditorError('invalid id: 1abc'));
    expect(workspace.document().children().map((s) => s.id())).toEqual(['bg', 'title', 'c1', 'box']);
  });

  it('任一成员不存在时报错', () => {
    expect(() => group(workspaceWith(...flat), 'g1 c1 r9')).toThrow(new EditorError('no such shape: r9'));
  });

  it('成员 id 重复时在构造阶段报错', () => {
    expect(() => new GroupCommand(new Workspace(), 'g1 c1 box c1'.split(' '))).toThrow(new EditorError('duplicate id: c1'));
  });

  it('参数少于 2 个时报错并附语法', () => {
    expect(() => new GroupCommand(new Workspace(), ['g1'])).toThrow('wrong number of arguments. usage: group <newGid> <id1> <id2>…');
  });

  it('无文档时报无文档', () => {
    expect(() => group(new Workspace(), 'g1 c1')).toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', () => {
    expect(() => new GroupCommand(new Workspace(), ['g1', 'c1']).undo()).toThrow('undo before execute');
  });
});
