import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import AddtoCommand from '../../../../plugins/core/AddtoCommand';
import BackCommand from '../../../../plugins/core/BackCommand';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import FrontCommand from '../../../../plugins/core/FrontCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

/** 根下依次为 bg、title、markers{c1, box, inner{dot}}。 */
async function sample(): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const line of [
    'rect bg 0 0 800 600',
    'text title 20 40 Title',
    'g markers',
    'circle c1 100 100 20 in markers',
    'rect box 10 10 50 50 in markers',
    'g inner in markers',
    'circle dot 1 1 1 in inner',
  ]) {
    new CreateCommand(receiver, line.split(' ')).execute();
  }
  return receiver;
}

function ids(receiver: Receiver, containerId?: string): string[] {
  const doc = receiver.document();
  const container = containerId === undefined ? doc : doc.requireNode(containerId);
  return container.children().map((shape) => shape.value.id());
}

describe('FrontCommand / BackCommand', () => {
  it('front 移到兄弟末尾（最上层），undo 回到原位置', async () => {
    const receiver = (await sample());
    const command = new FrontCommand(receiver, ['bg']);
    expect(command.execute().lines()).toEqual(['rect#bg brought to front']);
    expect(ids(receiver)).toEqual(['title', 'markers', 'bg']);
    expect(command.undo().lines()).toEqual(['rect#bg restored into svg']);
    expect(ids(receiver)).toEqual(['bg', 'title', 'markers']);
  });

  it('back 移到兄弟开头（最下层），undo 回到原位置', async () => {
    const receiver = (await sample());
    const command = new BackCommand(receiver, ['box']);
    expect(command.execute().lines()).toEqual(['rect#box sent to back']);
    expect(ids(receiver, 'markers')).toEqual(['box', 'c1', 'inner']);
    expect(command.undo().lines()).toEqual(['rect#box restored into g#markers']);
    expect(ids(receiver, 'markers')).toEqual(['c1', 'box', 'inner']);
  });

  it('已在最上层 / 最下层时位置不变', async () => {
    const receiver = (await sample());
    new FrontCommand(receiver, ['markers']).execute();
    new BackCommand(receiver, ['bg']).execute();
    expect(ids(receiver)).toEqual(['bg', 'title', 'markers']);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const receiver = (await sample());
    const command = new FrontCommand(receiver, ['c1']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(ids(receiver, 'markers')).toEqual(['box', 'inner', 'c1']);
  });

  it('id 不存在时报错；参数个数在构造时校验', async () => {
    await expect(async () => new FrontCommand((await sample()), ['r9']).execute()).rejects.toThrow(new EditorError('no such shape: r9'));
    await expect(async () => new BackCommand((await createReceiver()), [])).rejects.toThrow('wrong number of arguments. usage: back <id>');
  });
});

describe('AddtoCommand', () => {
  it('把图形移入容器作为最后一个子节点；undo 回到原父容器的原位置', async () => {
    const receiver = (await sample());
    const command = new AddtoCommand(receiver, ['inner', 'title']);
    expect(command.execute().lines()).toEqual(['text#title added to g#inner']);
    expect(ids(receiver)).toEqual(['bg', 'markers']);
    expect(ids(receiver, 'inner')).toEqual(['dot', 'title']);
    expect(command.undo().lines()).toEqual(['text#title restored into svg']);
    expect(ids(receiver)).toEqual(['bg', 'title', 'markers']);
    expect(ids(receiver, 'inner')).toEqual(['dot']);
  });

  it('目标已是其父容器时移到该容器末尾，不报错', async () => {
    const receiver = (await sample());
    expect(new AddtoCommand(receiver, ['markers', 'c1']).execute().lines()).toEqual(['circle#c1 added to g#markers']);
    expect(ids(receiver, 'markers')).toEqual(['box', 'inner', 'c1']);
  });

  it('容器连同子树一起移动', async () => {
    const receiver = (await sample());
    new CreateCommand(receiver, 'g other'.split(' ')).execute();
    new AddtoCommand(receiver, ['other', 'inner']).execute();
    expect(receiver.document().requireNode('dot').parent()).toBe(receiver.document().requireNode('inner'));
    expect(ids(receiver, 'other')).toEqual(['inner']);
  });

  it('目标是图形自身或其子孙时报错，文档不变', async () => {
    const receiver = (await sample());
    expect(() => new AddtoCommand(receiver, ['inner', 'markers']).execute()).toThrow(
      new EditorError('cannot add a container into itself or its descendant: markers'),
    );
    expect(() => new AddtoCommand(receiver, ['markers', 'markers']).execute()).toThrow('itself or its descendant');
    expect(ids(receiver)).toEqual(['bg', 'title', 'markers']);
  });

  it('目标不是容器 / 不存在、图形不存在时报错', async () => {
    const receiver = (await sample());
    expect(() => new AddtoCommand(receiver, ['bg', 'c1']).execute()).toThrow(new EditorError('not a container: bg'));
    expect(() => new AddtoCommand(receiver, ['g9', 'c1']).execute()).toThrow(new EditorError('no such shape: g9'));
    expect(() => new AddtoCommand(receiver, ['markers', 'r9']).execute()).toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数在构造时校验；无文档时报无文档', async () => {
    await expect(async () => new AddtoCommand((await createReceiver()), ['g1'])).rejects.toThrow('wrong number of arguments. usage: addto <gid> <id>');
    await expect(async () => new AddtoCommand((await createReceiver()), ['g1', 'r1']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new AddtoCommand((await sample()), ['markers', 'bg']).undo()).rejects.toThrow('undo before execute');
  });
});
