import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
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

/** 接口契约示例中的文档：根下依次为 bg、title、markers{c1, box}。 */
function sample(): Workspace {
  const workspace = workspaceWith('rect bg 0 0 800 600 #ffffff');
  new CreateCommand(workspace, ['text', 'title', '20', '40', 'My Diagram']).execute();
  for (const line of ['g markers', 'circle c1 100 100 20 red in markers', 'rect box 200 80 60 60 #3366ff in markers']) {
    new CreateCommand(workspace, line.split(' ')).execute();
  }
  return workspace;
}

function tree(workspace: Workspace, ...args: string[]): string[] {
  return [...new TreeCommand(workspace, args).execute().lines()];
}

describe('TreeCommand', () => {
  it('全文档：首行为画布尺寸，内联核心属性，不含外观属性', () => {
    expect(tree(sample())).toEqual([
      'svg (800x600)',
      '├── rect#bg  x=0 y=0 width=800 height=600',
      '├── text#title  x=20 y=40 text="My Diagram"',
      '└── g#markers',
      '    ├── circle#c1  cx=100 cy=100 r=20',
      '    └── rect#box  x=200 y=80 width=60 height=60',
    ]);
  });

  it('tree <id> 只输出以该图形为根的子树', () => {
    expect(tree(sample(), 'markers')).toEqual([
      'g#markers',
      '├── circle#c1  cx=100 cy=100 r=20',
      '└── rect#box  x=200 y=80 width=60 height=60',
    ]);
  });

  it('tree <叶子 id> 只输出该图形本行', () => {
    expect(tree(sample(), 'c1')).toEqual(['circle#c1  cx=100 cy=100 r=20']);
  });

  it('多层嵌套：非最后一个容器的子孙前缀为 │，最后一个为空白', () => {
    const workspace = workspaceWith(
      'g a',
      'g a1 in a',
      'line l1 0 0 1 1 in a1',
      'rect r1 0 0 1 1 in a',
      'g b',
      'ellipse e1 1 2 3 4 in b',
    );
    expect(tree(workspace)).toEqual([
      'svg (800x600)',
      '├── g#a',
      '│   ├── g#a1',
      '│   │   └── line#l1  x1=0 y1=0 x2=1 y2=1',
      '│   └── rect#r1  x=0 y=0 width=1 height=1',
      '└── g#b',
      '    └── ellipse#e1  cx=1 cy=2 rx=3 ry=4',
    ]);
  });

  it('空文档只输出画布尺寸，尺寸按数值格式输出', () => {
    const workspace = new Workspace();
    workspace.replace(new Document(100.5, 200));
    expect(tree(workspace)).toEqual(['svg (100.5x200)']);
  });

  it('空容器只输出该容器', () => {
    expect(tree(workspaceWith('g g1'), 'g1')).toEqual(['g#g1']);
  });

  it('id 不存在时报错', () => {
    expect(() => tree(sample(), 'r9')).toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数不符时报错并附语法', () => {
    expect(() => new TreeCommand(new Workspace(), ['a', 'b'])).toThrow('wrong number of arguments. usage: tree [id]');
  });

  it('无文档时报无文档', () => {
    expect(() => tree(new Workspace())).toThrow("no document. use 'init' or 'read' first");
  });

  it('不改变文档', () => {
    const workspace = sample();
    const before = tree(workspace);
    tree(workspace, 'markers');
    expect(tree(workspace)).toEqual(before);
  });
});
