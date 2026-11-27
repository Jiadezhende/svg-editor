import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import ShowCommand from '../../../../plugins/core/ShowCommand';
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

function show(receiver: Receiver, id: string): string[] {
  return [...new ShowCommand(receiver, [id]).execute().lines()];
}

describe('ShowCommand', () => {
  it('容器内的图形：首行父节点为容器，其后为核心属性行与外观属性行', async () => {
    const receiver = (await receiverWith(['g', 'markers'], ['circle', 'c1', '100', '100', '20', 'red', 'in', 'markers']));
    expect(show(receiver, 'c1')).toEqual(['circle#c1  parent=g#markers', '  cx=100 cy=100 r=20', '  fill=red']);
  });

  it('根级图形 parent=svg；未设置外观属性时省略外观行', async () => {
    const receiver = (await receiverWith(['line', 'l1', '0', '0', '100', '50']));
    expect(show(receiver, 'l1')).toEqual(['line#l1  parent=svg', '  x1=0 y1=0 x2=100 y2=50']);
  });

  it('text 的内容加双引号', async () => {
    const receiver = (await receiverWith(['text', 't1', '20', '40', 'My Diagram']));
    expect(show(receiver, 't1')).toEqual(['text#t1  parent=svg', '  x=20 y=40 text="My Diagram"']);
  });

  it('g 的核心属性行为子节点个数', async () => {
    const receiver = (await receiverWith(['g', 'g1'], ['rect', 'r1', '0', '0', '1', '1', 'in', 'g1'], ['g', 'g2', 'in', 'g1']));
    expect(show(receiver, 'g1')).toEqual(['g#g1  parent=svg', '  children=2']);
    expect(show(receiver, 'g2')).toEqual(['g#g2  parent=g#g1', '  children=0']);
  });

  it('id 不存在时报错', async () => {
    await expect(async () => show((await receiverWith()), 'r9')).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it.each([[[]], [['a', 'b']]])('参数个数不符时报错并附语法：%j', async (args) => {
    await expect(async () => new ShowCommand((await createReceiver()), args)).rejects.toThrow('wrong number of arguments. usage: show <id>');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => show((await createReceiver()), 'c1')).rejects.toThrow("no document. use 'init' or 'read' first");
  });
});
