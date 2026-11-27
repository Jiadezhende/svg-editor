import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import TreeCommand from '../../../../plugins/core/TreeCommand';
import UngroupCommand from '../../../../plugins/core/UngroupCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import EditorError from '../../../../src/backend/error/EditorError';

/** 根下为 scene{a, inner{b, c}, d}、e。 */
async function sample(): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const line of [
    'g scene',
    'rect a 0 0 1 1 in scene',
    'g inner in scene',
    'rect b 0 0 1 1 in inner',
    'rect c 0 0 1 1 in inner',
    'rect d 0 0 1 1 in scene',
    'rect e 0 0 1 1',
  ]) {
    new CreateCommand(receiver, line.split(' ')).execute();
  }
  return receiver;
}

function ids(receiver: Receiver, containerId: string): string[] {
  return receiver.document().requireNode(containerId).children().map((shape) => shape.value.id());
}

function tree(receiver: Receiver): string[] {
  return [...new TreeCommand(receiver, []).execute().lines()];
}

describe('UngroupCommand', () => {
  it('子图形按原顺序提升到父级，占据容器原来的位置', async () => {
    const receiver = (await sample());
    expect(new UngroupCommand(receiver, ['inner']).execute().lines()).toEqual([
      'g#inner ungrouped, 2 children moved to g#scene',
    ]);
    expect(ids(receiver, 'scene')).toEqual(['a', 'b', 'c', 'd']);
    expect(receiver.document().findNode('inner')).toBeNull();
  });

  it('undo 还原容器及其子图形的原位置与顺序', async () => {
    const receiver = (await sample());
    const before = tree(receiver);
    const command = new UngroupCommand(receiver, ['inner']);
    command.execute();
    expect(command.undo().lines()).toEqual(['g#inner restored into g#scene with 2 children']);
    expect(tree(receiver)).toEqual(before);
  });

  it('空容器解散后直接消失', async () => {
    const receiver = (await sample());
    new CreateCommand(receiver, 'g empty in scene'.split(' ')).execute();
    expect(new UngroupCommand(receiver, ['empty']).execute().lines()).toEqual([
      'g#empty ungrouped, 0 children moved to g#scene',
    ]);
    expect(ids(receiver, 'scene')).toEqual(['a', 'inner', 'd']);
  });

  it('undo 后再次 execute（redo）回显与首次相同', async () => {
    const receiver = (await sample());
    const command = new UngroupCommand(receiver, ['inner']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(ids(receiver, 'scene')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('根级容器不可解散，文档不变', async () => {
    const receiver = (await sample());
    const before = tree(receiver);
    expect(() => new UngroupCommand(receiver, ['scene']).execute()).toThrow(
      new EditorError('cannot ungroup top-level container: scene'),
    );
    expect(tree(receiver)).toEqual(before);
  });

  it('目标不是容器 / 不存在时报错', async () => {
    const receiver = (await sample());
    expect(() => new UngroupCommand(receiver, ['e']).execute()).toThrow(new EditorError('not a container: e'));
    expect(() => new UngroupCommand(receiver, ['g9']).execute()).toThrow(new EditorError('no such shape: g9'));
  });

  it('参数个数在构造时校验；无文档时报无文档', async () => {
    await expect(async () => new UngroupCommand((await createReceiver()), [])).rejects.toThrow('wrong number of arguments. usage: ungroup <gid>');
    await expect(async () => new UngroupCommand((await createReceiver()), ['g1']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', async () => {
    await expect(async () => new UngroupCommand((await sample()), ['inner']).undo()).rejects.toThrow('undo before execute');
  });
});
