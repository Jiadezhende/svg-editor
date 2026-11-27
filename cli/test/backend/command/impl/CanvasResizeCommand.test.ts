import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CanvasResizeCommand from '../../../../plugins/core/CanvasResizeCommand';
import CanvasShowCommand from '../../../../plugins/core/CanvasShowCommand';
import DocumentCommand from '../../../../src/backend/command/DocumentCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';

async function receiverWith(width: number, height: number): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(width, height));
  return receiver;
}

function resize(receiver: Receiver, ...args: string[]): string[] {
  return [...new CanvasResizeCommand(receiver, args).execute().lines()];
}

describe('CanvasResizeCommand', () => {
  it('是文档类命令；接受有参的输入，与 CanvasShowCommand 互斥', async () => {
    expect(new CanvasResizeCommand((await createReceiver()), ['1', '1'])).toBeInstanceOf(DocumentCommand);
    for (const args of [[], ['1'], ['1024', '768'], ['1', '2', '3']]) {
      expect(CanvasResizeCommand.accepts(args)).toBe(args.length > 0);
      expect(CanvasResizeCommand.accepts(args) && CanvasShowCommand.accepts(args)).toBe(false);
    }
  });

  it('修改尺寸并输出修改后的尺寸', async () => {
    const receiver = (await receiverWith(800, 600));
    expect(resize(receiver, '1024', '768.50')).toEqual(['canvas resized to 1024x768.5']);
    expect([receiver.document().width(), receiver.document().height()]).toEqual([1024, 768.5]);
  });

  it('修改尺寸不改动 viewBox', async () => {
    const receiver = (await receiverWith(200, 100));
    resize(receiver, '400', '300');
    expect(receiver.document().viewBox()).toEqual([0, 0, 200, 100]);
  });

  it.each([
    ['0', '600'],
    ['-1', '600'],
  ])('尺寸 %s x %s 非正数时报错，尺寸不变', async (w, h) => {
    const receiver = (await receiverWith(800, 600));
    expect(() => resize(receiver, w, h)).toThrow('canvas size must be positive');
    expect([receiver.document().width(), receiver.document().height()]).toEqual([800, 600]);
  });

  it('参数个数或格式错误在构造阶段报出', async () => {
    await expect(async () => new CanvasResizeCommand((await createReceiver()), ['400'])).rejects.toThrow('wrong number of arguments. usage: canvas <w> <h>');
    await expect(async () => new CanvasResizeCommand((await createReceiver()), ['a', '0'])).rejects.toThrow('not a number: a');
  });

  it('无文档时执行报"无文档"', async () => {
    await expect(async () => new CanvasResizeCommand((await createReceiver()), ['1024', '768']).execute()).rejects.toThrow(
      "no document. use 'init' or 'read' first",
    );
  });
});
