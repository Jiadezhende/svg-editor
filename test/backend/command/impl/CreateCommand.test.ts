import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

function workspaceWithDoc(): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  return workspace;
}

function create(workspace: Workspace, line: string): string[] {
  return [...new CreateCommand(workspace, line.split(' ')).execute().lines()];
}

function attributesOf(workspace: Workspace, id: string) {
  return workspace.document().requireShape(id).attributes();
}

describe('CreateCommand 创建', () => {
  it('create rect 挂在画布根末尾，写入几何属性与 fill', () => {
    const workspace = workspaceWithDoc();
    expect(create(workspace, 'rect r1 10 20 100 50 #eee')).toEqual(['rect#r1 created']);
    const doc = workspace.document();
    expect(doc.children().map((s) => s.id())).toEqual(['r1']);
    expect(attributesOf(workspace, 'r1')).toEqual([
      ['x', '10'],
      ['y', '20'],
      ['width', '100'],
      ['height', '50'],
      ['fill', '#eee'],
    ]);
  });

  it('6 种内置类型均可创建，省略 fill / stroke 时不写入', () => {
    const workspace = workspaceWithDoc();
    expect(create(workspace, 'circle c1 100 100 20 red')).toEqual(['circle#c1 created']);
    expect(create(workspace, 'ellipse e1 0 0 30 10')).toEqual(['ellipse#e1 created']);
    expect(create(workspace, 'line l1 0 0 100 100 black')).toEqual(['line#l1 created']);
    expect(create(workspace, 'g scene')).toEqual(['g#scene created']);
    expect(attributesOf(workspace, 'e1')).toEqual([
      ['cx', '0'],
      ['cy', '0'],
      ['rx', '30'],
      ['ry', '10'],
    ]);
    expect(attributesOf(workspace, 'l1').at(-1)).toEqual(['stroke', 'black']);
    expect(attributesOf(workspace, 'scene')).toEqual([]);
  });

  it('text 的内容为一个参数（含空格），不计引号', () => {
    const workspace = workspaceWithDoc();
    const command = new CreateCommand(workspace, ['text', 't1', '20', '40', 'My Diagram']);
    expect(command.execute().lines()).toEqual(['text#t1 created']);
    expect(attributesOf(workspace, 't1')).toEqual([
      ['x', '20'],
      ['y', '40'],
      ['text', 'My Diagram'],
    ]);
  });

  it('text 内容位上的 in 视为内容', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'text t1 0 0 in');
    expect(attributesOf(workspace, 't1').at(-1)).toEqual(['text', 'in']);
  });

  it('in 子句挂进指定容器末尾，回显容器', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'g node1');
    create(workspace, 'rect a 0 0 1 1 in node1');
    expect(create(workspace, 'rect start 120 100 160 60 #4a90d9 in node1')).toEqual([
      'rect#start created in g#node1',
    ]);
    const node1 = workspace.document().requireContainer('node1');
    expect(node1.children().map((s) => s.id())).toEqual(['a', 'start']);
    expect(attributesOf(workspace, 'start').at(-1)).toEqual(['fill', '#4a90d9']);
  });

  it('容器可嵌套创建', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'g outer');
    expect(create(workspace, 'g inner in outer')).toEqual(['g#inner created in g#outer']);
    expect(create(workspace, 'circle c1 0 0 1 in inner')).toEqual(['circle#c1 created in g#inner']);
  });

  it('负坐标、浮点合法；尺寸为 0 合法', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'rect r1 -10 0.5 0 0');
    expect(attributesOf(workspace, 'r1')).toEqual([
      ['x', '-10'],
      ['y', '0.5'],
      ['width', '0'],
      ['height', '0'],
    ]);
  });

  it('id 大小写不同视为不同 id；含 - 的 id 合法', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'rect r1 0 0 1 1');
    expect(create(workspace, 'rect R1 0 0 1 1')).toEqual(['rect#R1 created']);
    expect(create(workspace, 'rect start-label 0 0 1 1')).toEqual(['rect#start-label created']);
  });
});

describe('CreateCommand 参数格式（构造时）', () => {
  const workspace = new Workspace(); // 无文档：构造阶段不取文档

  it.each([['hexagon h1'], ['box n1 0 0 10 10 title'], ['hexagon']])('未注册类型报错：%s', (line) => {
    const type = line.split(' ')[0];
    expect(() => new CreateCommand(workspace, line.split(' '))).toThrow(
      new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`),
    );
  });

  it('无参时报参数个数不符，附通用语法', () => {
    expect(() => new CreateCommand(workspace, [])).toThrow(
      'wrong number of arguments. usage: create <type> <id> [params…] [in <containerId>]',
    );
  });

  it.each([
    ['rect', 'rect r1 0 0 1', 'create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]'],
    ['rect', 'rect', 'create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]'],
    ['rect', 'rect r1 0 0 1 1 red blue', 'create rect'],
    ['circle', 'circle c1 0 0 1 red in', 'create circle <id> <cx> <cy> <r> [fill] [in <containerId>]'],
    ['line', 'line l1 0 0 1 1 black in g1 x', 'create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]'],
    ['text', 'text t1 0 0 hello world', 'create text <id> <x> <y> <text> [in <containerId>]'],
    ['g', 'g g1 red', 'create g <id> [in <containerId>]'],
    ['g', 'g', 'create g <id> [in <containerId>]'],
  ])('%s 参数个数不符时报错并附该类型语法：%s', (_type, line, usage) => {
    expect(() => new CreateCommand(workspace, line.split(' '))).toThrow(`wrong number of arguments. usage: ${usage}`);
  });

  it('可选颜色位上的 in 一律视为关键字，其后缺容器 id 时报参数个数不符', () => {
    expect(() => new CreateCommand(workspace, 'rect r1 0 0 10 10 in'.split(' '))).toThrow('wrong number of arguments');
  });

  it('几何参数不是数字时报错', () => {
    expect(() => new CreateCommand(workspace, 'rect r1 a 0 1 1'.split(' '))).toThrow(new EditorError('not a number: a'));
  });

  it('参数个数先于数字校验', () => {
    expect(() => new CreateCommand(workspace, 'rect r1 a 0 1'.split(' '))).toThrow('wrong number of arguments');
  });

  it('颜色值不校验，原样接受', () => {
    expect(() => new CreateCommand(workspace, 'rect r1 0 0 1 1 not-a-color'.split(' '))).not.toThrow();
  });
});

describe('CreateCommand 业务校验（执行时）', () => {
  it('无文档时报无文档，先于其他业务校验', () => {
    const command = new CreateCommand(new Workspace(), 'rect 1abc 0 0 -1 1 in node9'.split(' '));
    expect(() => command.execute()).toThrow(new EditorError("no document. use 'init' or 'read' first"));
  });

  it('id 不合法时报错', () => {
    expect(() => create(workspaceWithDoc(), 'rect 1abc 0 0 1 1')).toThrow(new EditorError('invalid id: 1abc'));
  });

  it('尺寸为负时报错', () => {
    expect(() => create(workspaceWithDoc(), 'circle c1 0 0 -5')).toThrow(new EditorError('r must be non-negative'));
  });

  it('id 已存在时报错（含容器 id），文档不变', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'g g1');
    create(workspace, 'rect r1 0 0 1 1 in g1');
    expect(() => create(workspace, 'rect r1 0 0 1 1')).toThrow(new EditorError('id already exists: r1'));
    expect(() => create(workspace, 'circle g1 0 0 1')).toThrow('id already exists: g1');
    expect(workspace.document().children().map((s) => s.id())).toEqual(['g1']);
  });

  it('in 目标不存在 / 不是容器时报错', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'rect start 0 0 1 1');
    expect(() => create(workspace, 'rect r1 0 0 1 1 in node9')).toThrow(new EditorError('no such container: node9'));
    expect(() => create(workspace, 'rect r1 0 0 1 1 in start')).toThrow(new EditorError('not a container: start'));
  });
});

describe('CreateCommand 撤销与再次执行', () => {
  it('undo 摘除本次创建的图形', () => {
    const workspace = workspaceWithDoc();
    create(workspace, 'g g1');
    const command = new CreateCommand(workspace, 'rect r1 0 0 1 1 in g1'.split(' '));
    command.execute();
    expect(command.undo().lines()).toEqual(['rect#r1 removed']);
    expect(workspace.document().find('r1')).toBeNull();
    expect(workspace.document().requireContainer('g1').children()).toEqual([]);
  });

  it('undo 后再次 execute（redo）回显与首次相同', () => {
    const workspace = workspaceWithDoc();
    const command = new CreateCommand(workspace, 'circle c1 1 2 3 red'.split(' '));
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(attributesOf(workspace, 'c1')).toEqual([
      ['cx', '1'],
      ['cy', '2'],
      ['r', '3'],
      ['fill', 'red'],
    ]);
  });

  it('execute 之前 undo 属于程序缺陷', () => {
    const command = new CreateCommand(workspaceWithDoc(), ['g', 'g1']);
    expect(() => command.undo()).toThrow('undo before execute');
  });
});
