import { createHost, createReceiver } from '../../support/Plugins';
import { describe, expect, it } from 'vitest';
import Document from '../../../src/backend/receiver/document/Document';
import EditorError from '../../../src/backend/error/EditorError';
import Rect from '../../../plugins/core/Rect';
import { AttributeHandlerRegistry, NumericAttribute, Receiver, Shape, ShapeFactory, SvgReader, SvgWriter, TreeRenderer } from '../../../src/backend';

describe('Receiver 当前文档槽位', () => {
  it('无文档时取文档报"无文档"', async () => {
    await expect(async () => (await createReceiver()).document()).rejects.toThrow(new EditorError("no document. use 'init' or 'read' first"));
  });

  it('首次放入文档时返回 false，之后可取回', async () => {
    const receiver = (await createReceiver());
    const doc = new Document(800, 600);
    expect(receiver.replace(doc)).toBe(false);
    expect(receiver.document()).toBe(doc);
  });

  it('覆盖已有文档时返回 true，当前文档为新文档', async () => {
    const receiver = (await createReceiver());
    receiver.replace(new Document(800, 600));
    const next = new Document(400, 200);
    expect(receiver.replace(next)).toBe(true);
    expect(receiver.document()).toBe(next);
  });

  it('持有图形工厂：无文档时也可查询已注册的图形规格', async () => {
    const receiver = (await createReceiver());
    expect(receiver.shapeDefinition('rect').params).toEqual(Rect.params);
  });

  it('创建入口按 id 构造候选，逐项写入后校验', async () => {
    const receiver = (await createReceiver());
    const shape = receiver.createShape('rect', 'r1', [
      ['x', '1'], ['y', '2'], ['width', '3'], ['height', '4'],
    ]);
    expect(shape.value('x')).toBe(1);
    expect(shape.value('width')).toBe(3);
    expect(() => receiver.createShape('rect', 'r2')).toThrow('missing attribute: x');
  });

  it('设置入口用同一次匹配读取前后回显', async () => {
    const { receiver, handlers } = await createHost();
    receiver.replace(new Document(100, 100));
    const shape = receiver.createShape('rect', 'r1', [
      ['x', '1'], ['y', '2'], ['width', '3'], ['height', '4'],
    ]);
    receiver.document().insert(shape);
    class PaintAlias {
      static readonly handlerName = 'paint-alias';
      static matches(target: Shape, key: string): boolean { return target.type() === 'rect' && key === 'paint'; }
      static apply(target: Shape, _key: string, token: string): void { target.set('fill', token); }
      static display(target: Shape, _key: string): string | null { return target.display('fill'); }
    }
    handlers.register(PaintAlias);
    expect(receiver.set(shape, 'paint', 'red')).toEqual({ previous: null, current: 'red' });
    expect(receiver.set(shape, 'paint', 'blue')).toEqual({ previous: 'red', current: 'blue' });
  });

  it('设置入口在写入后校验，校验失败直接传播', async () => {
    const { factory, receiver } = await createHost();
    class Guarded extends Shape {
      static override readonly type = 'guarded';
      static override readonly params = [new NumericAttribute('x')];

      override move(): void {}
      override scale(): void {}

      override validate(): void {
        super.validate();
        if (this.value('x') === 9) throw new Error('guard failed');
      }
    }
    factory.register(Guarded);
    receiver.replace(new Document(100, 100));
    const shape = receiver.createShape('guarded', 'g1', [['x', '1']]);
    receiver.document().insert(shape);
    expect(() => receiver.set(shape, 'x', '9')).toThrow('guard failed');
  });

  it('文件路径：init 新建（不带路径）时没有路径，取路径报错', async () => {
    const receiver = (await createReceiver());
    receiver.replace(new Document(800, 600));
    expect(() => receiver.path()).toThrow(new EditorError("no file path. use 'save <file.svg>'"));
  });

  it('文件路径随文档替换和成功另存为更新', () => {
    const factory = new ShapeFactory();
    const files = { read: () => '', write: () => {} };
    const receiver = new Receiver(factory, files, new SvgReader(factory), new SvgWriter(), new AttributeHandlerRegistry(), new TreeRenderer());
    receiver.replace(new Document(800, 600), 'a.svg');
    expect(receiver.path()).toBe('a.svg');
    receiver.saveDocument('b.svg');
    expect(receiver.path()).toBe('b.svg');
    receiver.replace(new Document(800, 600));
    expect(() => receiver.path()).toThrow('no file path');
  });
});
