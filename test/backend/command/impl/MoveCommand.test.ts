import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import MoveCommand from '../../../../plugins/core/MoveCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

async function receiverWith(...lines: string[][]): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const args of lines) {
    new CreateCommand(receiver, args).execute();
  }
  return receiver;
}

function summaryOf(receiver: Receiver, id: string): string {
  return receiver.document().requireNode(id).value.summary();
}

describe('MoveCommand', () => {
  it('叶子：回显移动后的锚点；undo 回显移回的锚点并还原', async () => {
    const receiver = (await receiverWith(['circle', 'c1', '100', '100', '20', 'red']));
    const command = new MoveCommand(receiver, ['c1', '30', '0']);
    expect(command.execute().lines()).toEqual(['circle#c1 moved to (130,100)']);
    expect(command.undo().lines()).toEqual(['circle#c1 moved back to (100,100)']);
    expect(summaryOf(receiver, 'c1')).toBe('cx=100 cy=100 r=20');
  });

  it.each([
    [['rect', 'r1', '10', '20', '1', '1'], 'r1', 'rect#r1 moved to (15,25)'],
    [['ellipse', 'e1', '10', '20', '1', '1'], 'e1', 'ellipse#e1 moved to (15,25)'],
    [['line', 'l1', '10', '20', '30', '40'], 'l1', 'line#l1 moved to (15,25)'],
    [['text', 't1', '10', '20', 'hi'], 't1', 'text#t1 moved to (15,25)'],
  ])('各类型的锚点：%j', async (create, id, echo) => {
    const receiver = (await receiverWith(create));
    expect(new MoveCommand(receiver, [id, '5', '5']).execute().lines()).toEqual([echo]);
  });

  it('line 两端同步平移', async () => {
    const receiver = (await receiverWith(['line', 'l1', '0', '0', '100', '50']));
    new MoveCommand(receiver, ['l1', '10', '-10']).execute();
    expect(summaryOf(receiver, 'l1')).toBe('x1=10 y1=-10 x2=110 y2=40');
  });

  it('容器：回显偏移，子孙同步平移；undo 回显反向偏移并还原整棵子树', async () => {
    const receiver = (await receiverWith(
      ['g', 'node2'],
      ['rect', 'process', '520', '100', '160', '60', 'in', 'node2'],
      ['text', 'label', '545', '135', 'x', 'in', 'node2'],
    ));
    const command = new MoveCommand(receiver, ['node2', '0', '100']);
    expect(command.execute().lines()).toEqual(['g#node2 moved by (0,100)']);
    expect(summaryOf(receiver, 'process')).toBe('x=520 y=200 width=160 height=60');
    expect(summaryOf(receiver, 'label')).toBe('x=545 y=235 text="x"');
    expect(command.undo().lines()).toEqual(['g#node2 moved back by (0,-100)']);
    expect(summaryOf(receiver, 'process')).toBe('x=520 y=100 width=160 height=60');
    expect(summaryOf(receiver, 'label')).toBe('x=545 y=135 text="x"');
  });

  it('负数、浮点合法；undo 精确还原', async () => {
    const receiver = (await receiverWith(['rect', 'r1', '0.1', '0.2', '1', '1']));
    const command = new MoveCommand(receiver, ['r1', '-10', '0.5']);
    expect(command.execute().lines()).toEqual(['rect#r1 moved to (-9.9,0.7)']);
    command.undo();
    expect(receiver.document().requireNode('r1').value.value('x')).toBe(0.1);
    expect(receiver.document().requireNode('r1').value.value('y')).toBe(0.2);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const receiver = (await receiverWith(['circle', 'c1', '100', '100', '20']));
    const command = new MoveCommand(receiver, ['c1', '30', '0']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
  });

  it('变换失败时恢复整棵子树，不留下部分修改', async () => {
    const receiver = (await receiverWith(['g', 'g1'], ['rect', 'r1', '10', '20', '30', '40', 'in', 'g1']));
    receiver.document().requireNode('r1').value.set('y', `1${'0'.repeat(308)}`);
    const before = receiver.document().requireNode('r1').value.entries();
    expect(() => new MoveCommand(receiver, ['g1', '1', `1${'0'.repeat(308)}`]).execute()).toThrow('y must be a finite number');
    expect(receiver.document().requireNode('r1').value.entries()).toEqual(before);
  });

  it('id 不存在时报错', async () => {
    await expect(async () => new MoveCommand((await receiverWith()), ['r9', '1', '1']).execute()).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数与数字在构造时校验', async () => {
    await expect(async () => new MoveCommand((await createReceiver()), ['r1', '1'])).rejects.toThrow('wrong number of arguments. usage: move <id> <dx> <dy>');
    await expect(async () => new MoveCommand((await createReceiver()), ['r1', 'a', '1'])).rejects.toThrow('not a number: a');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => new MoveCommand((await createReceiver()), ['r1', '1', '1']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new MoveCommand((await createReceiver()), ['r1', '1', '1']).undo()).rejects.toThrow('undo before execute');
  });
});
