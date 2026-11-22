import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import GroupCommand from '../../../../plugins/core/GroupCommand';
import TreeCommand from '../../../../plugins/core/TreeCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

async function receiverWith(...lines: string[]): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const line of lines) {
    new CreateCommand(receiver, line.split(' ')).execute();
  }
  return receiver;
}

function tree(receiver: Receiver): string[] {
  return [...new TreeCommand(receiver, []).execute().lines()];
}

function group(receiver: Receiver, line: string): string[] {
  return [...new GroupCommand(receiver, line.split(' ')).execute().lines()];
}

const flat = ['rect bg 0 0 1 1', 'text title 0 0 t', 'circle c1 0 0 1', 'rect box 0 0 1 1'];

describe('GroupCommand', () => {
  it('收编根下的图形：新容器插在第一个成员的位置，成员按文档顺序排列', async () => {
    const receiver = (await receiverWith(...flat));
    expect(group(receiver, 'markers c1 box')).toEqual(['g#markers created with 2 children']);
    expect(tree(receiver)).toEqual([
      'svg (800x600)',
      '├── rect#bg  x=0 y=0 width=1 height=1',
      '├── text#title  x=0 y=0 text="t"',
      '└── g#markers',
      '    ├── circle#c1  cx=0 cy=0 r=1',
      '    └── rect#box  x=0 y=0 width=1 height=1',
    ]);
  });

  it('成员顺序取文档顺序，与参数顺序无关', async () => {
    const receiver = (await receiverWith(...flat));
    group(receiver, 'g1 box bg');
    expect(receiver.document().children().map((s) => s.value.id())).toEqual(['g1', 'title', 'c1']);
    expect(receiver.document().requireNode('g1').children().map((s) => s.value.id())).toEqual(['bg', 'box']);
  });

  it('成员来自不同父容器：全部摘出，新容器插在文档顺序第一个成员的父容器中', async () => {
    const receiver = (await receiverWith('g a', 'rect r1 0 0 1 1 in a', 'rect r2 0 0 1 1 in a', 'g b', 'rect r3 0 0 1 1 in b'));
    group(receiver, 'mix r3 r2');
    expect(tree(receiver)).toEqual([
      'svg (800x600)',
      '├── g#a',
      '│   ├── rect#r1  x=0 y=0 width=1 height=1',
      '│   └── g#mix',
      '│       ├── rect#r2  x=0 y=0 width=1 height=1',
      '│       └── rect#r3  x=0 y=0 width=1 height=1',
      '└── g#b',
    ]);
  });

  it('undo 一次还原全部成员的原父容器与原位置，新容器消失', async () => {
    const receiver = (await receiverWith('g a', 'rect r1 0 0 1 1 in a', 'rect r2 0 0 1 1 in a', 'g b', 'rect r3 0 0 1 1 in b', 'circle c 0 0 1'));
    const before = tree(receiver);
    const command = new GroupCommand(receiver, 'mix c r1 r3'.split(' '));
    command.execute();
    expect(command.undo().lines()).toEqual(['g#mix removed, 3 children restored']);
    expect(tree(receiver)).toEqual(before);
    expect(receiver.document().findNode('mix')).toBeNull();
  });

  it('undo 后再次 execute（redo）回显与首次相同，结构相同', async () => {
    const receiver = (await receiverWith(...flat));
    const command = new GroupCommand(receiver, 'markers c1 box'.split(' '));
    const first = command.execute().lines();
    const after = tree(receiver);
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(tree(receiver)).toEqual(after);
  });

  it('可以收编容器，容器连同子树移动', async () => {
    const receiver = (await receiverWith('g inner', 'rect r1 0 0 1 1 in inner', 'rect r2 0 0 1 1'));
    group(receiver, 'outer inner r2');
    expect(receiver.document().requireNode('r1').parent()).toBe(receiver.document().requireNode('inner'));
    expect(receiver.document().requireNode('inner').parent()).toBe(receiver.document().requireNode('outer'));
  });

  it('成员中有容器与其子孙时报错，文档不变', async () => {
    const receiver = (await receiverWith('g markers', 'circle c1 0 0 1 in markers'));
    const before = tree(receiver);
    expect(() => group(receiver, 'bad c1 markers')).toThrow(
      new EditorError('cannot group a container into its own descendant: markers'),
    );
    expect(tree(receiver)).toEqual(before);
  });

  it('newGid 已存在 / 不合法时报错，文档不变', async () => {
    const receiver = (await receiverWith(...flat));
    expect(() => group(receiver, 'bg c1')).toThrow(new EditorError('id already exists: bg'));
    expect(() => group(receiver, '1abc c1')).toThrow(new EditorError('invalid id: 1abc'));
    expect(receiver.document().children().map((s) => s.value.id())).toEqual(['bg', 'title', 'c1', 'box']);
  });

  it('任一成员不存在时报错', async () => {
    await expect(async () => group((await receiverWith(...flat)), 'g1 c1 r9')).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it('成员 id 重复时在构造阶段报错', async () => {
    await expect(async () => new GroupCommand((await createReceiver()), 'g1 c1 box c1'.split(' '))).rejects.toThrow(new EditorError('duplicate id: c1'));
  });

  it('参数少于 2 个时报错并附语法', async () => {
    await expect(async () => new GroupCommand((await createReceiver()), ['g1'])).rejects.toThrow('wrong number of arguments. usage: group <newGid> <id1> <id2>…');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => group((await createReceiver()), 'g1 c1')).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new GroupCommand((await createReceiver()), ['g1', 'c1']).undo()).rejects.toThrow('undo before execute');
  });
});
