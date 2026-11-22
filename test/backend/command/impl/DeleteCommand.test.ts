import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import DeleteCommand from '../../../../plugins/core/DeleteCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

/** 画布根下依次为 bg、title、markers{c1, box}。 */
async function sample(): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const line of [
    'rect bg 0 0 800 600 #fff',
    'text title 20 40 Title',
    'g markers',
    'circle c1 100 100 20 red in markers',
    'rect box 10 10 50 50 in markers',
  ]) {
    new CreateCommand(receiver, line.split(' ')).execute();
  }
  return receiver;
}

function ids(shapes: readonly { value: { id(): string } }[]): string[] {
  return shapes.map((shape) => shape.value.id());
}

describe('DeleteCommand 删除', () => {
  it('删除容器内的叶子：回显 deleted，从父容器中摘除', async () => {
    const receiver = (await sample());
    expect(new DeleteCommand(receiver, ['box']).execute().lines()).toEqual(['rect#box deleted']);
    expect(ids(receiver.document().requireNode('markers').children())).toEqual(['c1']);
    expect(receiver.document().findNode('box')).toBeNull();
  });

  it('undo 回到原父容器的原位置，回显 restored into 父容器', async () => {
    const receiver = (await sample());
    const command = new DeleteCommand(receiver, ['c1']);
    command.execute();
    expect(command.undo().lines()).toEqual(['circle#c1 restored into g#markers']);
    expect(ids(receiver.document().requireNode('markers').children())).toEqual(['c1', 'box']);
  });

  it('根级图形 undo 回显父节点为 svg，回到原位置', async () => {
    const receiver = (await sample());
    const command = new DeleteCommand(receiver, ['title']);
    command.execute();
    expect(ids(receiver.document().children())).toEqual(['bg', 'markers']);
    expect(command.undo().lines()).toEqual(['text#title restored into svg']);
    expect(ids(receiver.document().children())).toEqual(['bg', 'title', 'markers']);
  });

  it('删除容器连同全部子孙，子孙 id 均不可再访问；undo 后全部恢复', async () => {
    const receiver = (await sample());
    const doc = receiver.document();
    const command = new DeleteCommand(receiver, ['markers']);
    expect(command.execute().lines()).toEqual(['g#markers deleted']);
    for (const id of ['markers', 'c1', 'box']) {
      expect(() => doc.requireNode(id).value).toThrow(`no such shape: ${id}`);
    }
    expect(command.undo().lines()).toEqual(['g#markers restored into svg']);
    expect(ids(doc.requireNode('markers').children())).toEqual(['c1', 'box']);
    expect(doc.requireNode('box').parent()).toBe(doc.requireNode('markers'));
  });

  it('被删除的 id 可再次创建；undo 后再次 execute（redo）回显与首次相同', async () => {
    const receiver = (await sample());
    const command = new DeleteCommand(receiver, ['bg']);
    const first = command.execute().lines();
    expect(() => new CreateCommand(receiver, 'g bg'.split(' ')).execute()).not.toThrow();
    new DeleteCommand(receiver, ['bg']).execute();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
  });

  it('id 不存在时报错，文档不变', async () => {
    const receiver = (await sample());
    expect(() => new DeleteCommand(receiver, ['r9']).execute()).toThrow(new EditorError('no such shape: r9'));
    expect(ids(receiver.document().children())).toEqual(['bg', 'title', 'markers']);
  });

  it.each([[[]], [['a', 'b']]])('参数个数不符时报错并附语法：%j', async (args) => {
    await expect(async () => new DeleteCommand((await createReceiver()), args)).rejects.toThrow('wrong number of arguments. usage: delete <id>');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => new DeleteCommand((await createReceiver()), ['r1']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new DeleteCommand((await sample()), ['bg']).undo()).rejects.toThrow('undo before execute');
  });
});
