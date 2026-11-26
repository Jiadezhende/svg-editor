import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it, vi } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

async function receiverWithDoc(): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  return receiver;
}

function create(receiver: Receiver, line: string): string[] {
  return [...new CreateCommand(receiver, line.split(' ')).execute().lines()];
}

/** 图形的 show 属性行：核心属性行，有外观属性时再加一行。 */
function detailsOf(receiver: Receiver, id: string): string[] {
  return receiver.document().requireNode(id).value.details();
}

describe('CreateCommand 创建', () => {
  it('把工厂返回的模型加入文档，不在命令内自行构造', async () => {
    const receiver = (await receiverWithDoc());
    const supplied = receiver.createShape('rect', 'r1', new Map([['x', 10], ['y', 20], ['width', 30], ['height', 40]]));
    vi.spyOn(receiver, 'createShape').mockReturnValue(supplied);
    create(receiver, 'rect r1 1 2 3 4');
    expect(receiver.document().requireNode('r1').value).toBe(supplied);
  });

  it('create rect 挂在画布根末尾，写入几何属性与 fill', async () => {
    const receiver = (await receiverWithDoc());
    expect(create(receiver, 'rect r1 10 20 100 50 #eee')).toEqual(['rect#r1 created']);
    const doc = receiver.document();
    expect(doc.children().map((s) => s.value.id())).toEqual(['r1']);
    expect(detailsOf(receiver, 'r1')).toEqual(['x=10 y=20 width=100 height=50', 'fill=#eee']);
  });

  it('6 种内置类型均可创建，省略 fill / stroke 时不写入', async () => {
    const receiver = (await receiverWithDoc());
    expect(create(receiver, 'circle c1 100 100 20 red')).toEqual(['circle#c1 created']);
    expect(create(receiver, 'ellipse e1 0 0 30 10')).toEqual(['ellipse#e1 created']);
    expect(create(receiver, 'line l1 0 0 100 100 black')).toEqual(['line#l1 created']);
    expect(create(receiver, 'g scene')).toEqual(['g#scene created']);
    expect(detailsOf(receiver, 'e1')).toEqual(['cx=0 cy=0 rx=30 ry=10']);
    expect(detailsOf(receiver, 'l1')).toEqual(['x1=0 y1=0 x2=100 y2=100', 'stroke=black']);
    expect(detailsOf(receiver, 'scene')).toEqual(['']);
  });

  it('text 的内容为一个参数（含空格），不计引号', async () => {
    const receiver = (await receiverWithDoc());
    const command = new CreateCommand(receiver, ['text', 't1', '20', '40', 'My Diagram']);
    expect(command.execute().lines()).toEqual(['text#t1 created']);
    expect(detailsOf(receiver, 't1')).toEqual(['x=20 y=40 text="My Diagram"']);
  });

  it('text 内容位上的 in 视为内容', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'text t1 0 0 in');
    expect(detailsOf(receiver, 't1')).toEqual(['x=0 y=0 text="in"']);
  });

  it('in 子句挂进指定容器末尾，回显容器', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'g node1');
    create(receiver, 'rect a 0 0 1 1 in node1');
    expect(create(receiver, 'rect start 120 100 160 60 #4a90d9 in node1')).toEqual([
      'rect#start created in g#node1',
    ]);
    const node1 = receiver.document().requireNode('node1');
    expect(node1.children().map((s) => s.value.id())).toEqual(['a', 'start']);
    expect(detailsOf(receiver, 'start')).toEqual(['x=120 y=100 width=160 height=60', 'fill=#4a90d9']);
  });

  it('容器可嵌套创建', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'g outer');
    expect(create(receiver, 'g inner in outer')).toEqual(['g#inner created in g#outer']);
    expect(create(receiver, 'circle c1 0 0 1 in inner')).toEqual(['circle#c1 created in g#inner']);
  });

  it('负坐标、浮点合法；尺寸为 0 合法', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'rect r1 -10 0.5 0 0');
    expect(detailsOf(receiver, 'r1')).toEqual(['x=-10 y=0.5 width=0 height=0']);
  });

  it('id 大小写不同视为不同 id；含 - 的 id 合法', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'rect r1 0 0 1 1');
    expect(create(receiver, 'rect R1 0 0 1 1')).toEqual(['rect#R1 created']);
    expect(create(receiver, 'rect start-label 0 0 1 1')).toEqual(['rect#start-label created']);
  });
});

describe('CreateCommand 参数格式（构造时）', async () => {
  const receiver = (await createReceiver()); // 无文档：构造阶段不取文档

  it.each([['hexagon h1'], ['box n1 0 0 10 10 title'], ['hexagon']])('未注册类型报错：%s', (line) => {
    const type = line.split(' ')[0];
    expect(() => new CreateCommand(receiver, line.split(' '))).toThrow(
      new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`),
    );
  });

  it('无参时报参数个数不符，附通用语法', () => {
    expect(() => new CreateCommand(receiver, [])).toThrow(
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
    expect(() => new CreateCommand(receiver, line.split(' '))).toThrow(`wrong number of arguments. usage: ${usage}`);
  });

  it('可选颜色位上的 in 一律视为关键字，其后缺容器 id 时报参数个数不符', () => {
    expect(() => new CreateCommand(receiver, 'rect r1 0 0 10 10 in'.split(' '))).toThrow('wrong number of arguments');
  });

  it('几何参数不是数字时报错', () => {
    expect(() => new CreateCommand(receiver, 'rect r1 a 0 1 1'.split(' '))).toThrow(new EditorError('not a number: a'));
  });

  it('参数个数先于数字校验', () => {
    expect(() => new CreateCommand(receiver, 'rect r1 a 0 1'.split(' '))).toThrow('wrong number of arguments');
  });

  it('颜色值不校验，原样接受', () => {
    expect(() => new CreateCommand(receiver, 'rect r1 0 0 1 1 not-a-color'.split(' '))).not.toThrow();
  });
});

describe('CreateCommand 业务校验（执行时）', () => {
  it('无文档时报无文档，先于其他业务校验', async () => {
    const command = new CreateCommand((await createReceiver()), 'rect 1abc 0 0 1 1 in node9'.split(' '));
    expect(() => command.execute()).toThrow(new EditorError("no document. use 'init' or 'read' first"));
  });

  it('id 不合法时报错', async () => {
    await expect(async () => create((await receiverWithDoc()), 'rect 1abc 0 0 1 1')).rejects.toThrow(new EditorError('invalid id: 1abc'));
  });

  it('尺寸为负时报错', async () => {
    await expect(async () => create((await receiverWithDoc()), 'circle c1 0 0 -5')).rejects.toThrow(new EditorError('r must be non-negative'));
  });

  it('id 已存在时报错（含容器 id），文档不变', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'g g1');
    create(receiver, 'rect r1 0 0 1 1 in g1');
    expect(() => create(receiver, 'rect r1 0 0 1 1')).toThrow(new EditorError('id already exists: r1'));
    expect(() => create(receiver, 'circle g1 0 0 1')).toThrow('id already exists: g1');
    expect(receiver.document().children().map((s) => s.value.id())).toEqual(['g1']);
  });

  it('in 目标不存在 / 不是容器时报错', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'rect start 0 0 1 1');
    expect(() => create(receiver, 'rect r1 0 0 1 1 in node9')).toThrow(new EditorError('no such container: node9'));
    expect(() => create(receiver, 'rect r1 0 0 1 1 in start')).toThrow(new EditorError('not a container: start'));
  });
});

describe('CreateCommand 撤销与再次执行', () => {
  it('undo 摘除本次创建的图形', async () => {
    const receiver = (await receiverWithDoc());
    create(receiver, 'g g1');
    const command = new CreateCommand(receiver, 'rect r1 0 0 1 1 in g1'.split(' '));
    command.execute();
    expect(command.undo().lines()).toEqual(['rect#r1 removed']);
    expect(receiver.document().findNode('r1')).toBeNull();
    expect(receiver.document().requireNode('g1').children()).toEqual([]);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const receiver = (await receiverWithDoc());
    const command = new CreateCommand(receiver, 'circle c1 1 2 3 red'.split(' '));
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(detailsOf(receiver, 'c1')).toEqual(['cx=1 cy=2 r=3', 'fill=red']);
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    const command = new CreateCommand((await receiverWithDoc()), ['g', 'g1']);
    expect(() => command.undo()).toThrow('undo before execute');
  });
});
