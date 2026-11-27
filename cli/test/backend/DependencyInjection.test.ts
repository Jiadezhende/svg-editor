import { createClientWithCommands } from '../support/Plugins';
import { describe, expect, it, vi } from 'vitest';
import { AttributeHandlerRegistry, TreeRenderer, NumericAttribute, Document, Shape, ShapeFactory, SvgReader, SvgWriter, Receiver } from '../../src/backend';
import CreateCommand from '../../plugins/core/CreateCommand';
import ReadCommand from '../../plugins/core/ReadCommand';
import SaveCommand from '../../plugins/core/SaveCommand';

class Marker extends Shape {
  static override readonly type = 'marker';
  static override readonly params = [new NumericAttribute('x')];

  override move(): void {}
  override scale(): void {}
}

describe('会话依赖注入', () => {
  it('创建与读入使用宿主选定的工厂，保存复用注入 writer 和内存文件服务', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const storage = new Map<string, string>();
    const files = {
      read: vi.fn((path: string) => storage.get(path)!),
      write: vi.fn((path: string, text: string) => { storage.set(path, text); }),
    };
    const reader = new SvgReader(factory);
    const read = vi.spyOn(reader, 'read');
    const writer = new SvgWriter();
    const write = vi.spyOn(writer, 'write');
    const receiver = new Receiver(factory, files, reader, writer, new AttributeHandlerRegistry(), new TreeRenderer());
    const original = new Document(40, 50);
    receiver.replace(original);
    const client = createClientWithCommands(receiver, [CreateCommand, ReadCommand, SaveCommand]);

    expect(() => client.execute(['create', 'rect', 'r', '0', '0', '1', '1'])).toThrow('unknown shape type: rect');
    client.execute(['create', 'marker', 'm', '7']);
    const model = original.requireNode('m').value;
    expect(model).toBeInstanceOf(Marker);
    client.execute(['save', 'memory.svg']);
    expect(write).toHaveBeenCalledWith(original);
    expect(storage.get('memory.svg')).toContain('<marker id="m" x="7"/>');
    client.execute(['read', 'memory.svg']);
    expect(read).toHaveBeenCalledWith(storage.get('memory.svg'));
    expect(receiver.document().requireNode('m').value).toBeInstanceOf(Marker);
    expect(receiver.document().requireNode('m').value.value('x')).toBe(7);
    client.execute(['save']);
    expect(files.write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('替换的读写服务失败时保留文档、路径和可撤销历史', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const files = {
      read: () => 'input',
      write: () => { throw new Error('write failed'); },
    };
    const reader = { read: () => { throw new Error('parse failed'); } };
    const writer = { write: () => 'output' };
    const receiver = new Receiver(factory, files, reader, writer, new AttributeHandlerRegistry(), new TreeRenderer());
    const original = new Document(40, 50);
    receiver.replace(original, 'original.svg');
    const client = createClientWithCommands(receiver, [CreateCommand, ReadCommand, SaveCommand]);
    client.execute(['create', 'marker', 'm', '7']);
    expect(() => client.execute(['read', 'bad.svg'])).toThrow('parse failed');
    expect(() => client.execute(['save', 'bad.svg'])).toThrow('write failed');
    expect(receiver.document()).toBe(original);
    expect(receiver.path()).toBe('original.svg');
    client.execute(['undo']);
    expect(original.findNode('m')).toBeNull();
    client.execute(['redo']);
    expect(original.requireNode('m').value.value('x')).toBe(7);
  });
});
