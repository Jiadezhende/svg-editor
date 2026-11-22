import { describe, expect, it, vi } from 'vitest';
import { AttributeHandlerRegistry, TreeRenderer, Client, CoordinateSpec, Document, Shape, ShapeFactory, SvgReader, SvgWriter, Workspace } from '../../src/backend';
import CreateCommand from '../../plugins/core/CreateCommand';
import ReadCommand from '../../plugins/core/ReadCommand';
import SaveCommand from '../../plugins/core/SaveCommand';

class Marker extends Shape {
  static override readonly type = 'marker';
  static override readonly params = [new CoordinateSpec('x', 'x')];
}

describe('会话依赖注入', () => {
  it('创建与读入使用宿主选定的工厂，保存复用注入 writer 的映射和内存文件服务', () => {
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
    const workspace = new Workspace(factory, files, reader, writer, new AttributeHandlerRegistry(), new TreeRenderer());
    const original = new Document(40, 50);
    workspace.replace(original);
    const client = new Client(workspace);
    for (const command of [CreateCommand, ReadCommand, SaveCommand]) client.register(command);

    expect(() => client.execute(['create', 'rect', 'r', '0', '0', '1', '1'])).toThrow('unknown shape type: rect');
    client.execute(['create', 'marker', 'm', '7']);
    const model = original.requireNode('m').value;
    expect(model).toBeInstanceOf(Marker);
    workspace.svgWriter().register({
      matches: (shape) => shape instanceof Marker,
      write: (shape) => ({ type: 'marker', attributes: [['id', shape.id()], ['x', shape.value('x')!]] }),
    });
    expect(workspace.shapes()).toBe(factory);
    expect(workspace.files()).toBe(files);
    expect(workspace.svgReader()).toBe(reader);
    expect(workspace.svgWriter()).toBe(writer);
    client.execute(['save', 'memory.svg']);
    expect(write).toHaveBeenCalledWith(original);
    expect(storage.get('memory.svg')).toContain('<marker id="m" x="7"/>');
    client.execute(['read', 'memory.svg']);
    expect(read).toHaveBeenCalledWith(storage.get('memory.svg'));
    expect(workspace.document().requireNode('m').value).toBeInstanceOf(Marker);
    expect(workspace.document().requireNode('m').value.value('x')).toBe(7);
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
    const writer = { register: () => {}, write: () => 'output' };
    const workspace = new Workspace(factory, files, reader, writer, new AttributeHandlerRegistry(), new TreeRenderer());
    const original = new Document(40, 50);
    workspace.replace(original, 'original.svg');
    const client = new Client(workspace);
    for (const command of [CreateCommand, ReadCommand, SaveCommand]) client.register(command);
    client.execute(['create', 'marker', 'm', '7']);
    expect(() => client.execute(['read', 'bad.svg'])).toThrow('parse failed');
    expect(() => client.execute(['save', 'bad.svg'])).toThrow('write failed');
    expect(workspace.document()).toBe(original);
    expect(workspace.path()).toBe('original.svg');
    client.execute(['undo']);
    expect(original.findNode('m')).toBeNull();
    client.execute(['redo']);
    expect(original.requireNode('m').value.value('x')).toBe(7);
  });
});
