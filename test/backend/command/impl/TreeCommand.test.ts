import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
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

/** 接口契约示例中的文档：根下依次为 bg、title、markers{c1, box}。 */
async function sample(): Promise<Receiver> {
  const receiver = (await receiverWith('rect bg 0 0 800 600 #ffffff'));
  new CreateCommand(receiver, ['text', 'title', '20', '40', 'My Diagram']).execute();
  for (const line of ['g markers', 'circle c1 100 100 20 red in markers', 'rect box 200 80 60 60 #3366ff in markers']) {
    new CreateCommand(receiver, line.split(' ')).execute();
  }
  return receiver;
}

function tree(receiver: Receiver, ...args: string[]): string[] {
  return [...new TreeCommand(receiver, args).execute().lines()];
}

describe('TreeCommand', () => {
  it('全文档：首行为画布尺寸，内联核心属性，不含外观属性', async () => {
    expect(tree((await sample()))).toEqual([
      'svg (800x600)',
      '├── rect#bg  x=0 y=0 width=800 height=600',
      '├── text#title  x=20 y=40 text="My Diagram"',
      '└── g#markers',
      '    ├── circle#c1  cx=100 cy=100 r=20',
      '    └── rect#box  x=200 y=80 width=60 height=60',
    ]);
  });

  it('tree <id> 只输出以该图形为根的子树', async () => {
    expect(tree((await sample()), 'markers')).toEqual([
      'g#markers',
      '├── circle#c1  cx=100 cy=100 r=20',
      '└── rect#box  x=200 y=80 width=60 height=60',
    ]);
  });

  it('tree <叶子 id> 只输出该图形本行', async () => {
    expect(tree((await sample()), 'c1')).toEqual(['circle#c1  cx=100 cy=100 r=20']);
  });

  it('多层嵌套：非最后一个容器的子孙前缀为 │，最后一个为空白', async () => {
    const receiver = (await receiverWith(
      'g a',
      'g a1 in a',
      'line l1 0 0 1 1 in a1',
      'rect r1 0 0 1 1 in a',
      'g b',
      'ellipse e1 1 2 3 4 in b',
    ));
    expect(tree(receiver)).toEqual([
      'svg (800x600)',
      '├── g#a',
      '│   ├── g#a1',
      '│   │   └── line#l1  x1=0 y1=0 x2=1 y2=1',
      '│   └── rect#r1  x=0 y=0 width=1 height=1',
      '└── g#b',
      '    └── ellipse#e1  cx=1 cy=2 rx=3 ry=4',
    ]);
  });

  it('空文档只输出画布尺寸，尺寸按数值格式输出', async () => {
    const receiver = (await createReceiver());
    receiver.replace(new Document(100.5, 200));
    expect(tree(receiver)).toEqual(['svg (100.5x200)']);
  });

  it('空容器只输出该容器', async () => {
    expect(tree((await receiverWith('g g1')), 'g1')).toEqual(['g#g1']);
  });

  it('id 不存在时报错', async () => {
    await expect(async () => tree((await sample()), 'r9')).rejects.toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数不符时报错并附语法', async () => {
    await expect(async () => new TreeCommand((await createReceiver()), ['a', 'b'])).rejects.toThrow('wrong number of arguments. usage: tree [id]');
  });

  it('无文档时报无文档', async () => {
    await expect(async () => tree((await createReceiver()))).rejects.toThrow("no document. use 'init' or 'read' first");
  });

  it('不改变文档', async () => {
    const receiver = (await sample());
    const before = tree(receiver);
    tree(receiver, 'markers');
    expect(tree(receiver)).toEqual(before);
  });
});
