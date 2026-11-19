import { describe, expect, it, vi } from 'vitest';
import { AttributeHandlerRegistry, Client, Document, EditorError, Shape, ShapeFactory, SvgReader, SvgWriter, Workspace } from '../../../../src/backend';
import type { SvgElement, SvgShapeMapping } from '../../../../src/backend';
import ReadCommand from '../../../../src/backend/command/impl/ReadCommand';
import SaveCommand from '../../../../src/backend/command/impl/SaveCommand';
import MoveCommand from '../../../../src/backend/command/impl/MoveCommand';
import TreeCommand from '../../../../src/backend/command/impl/TreeCommand';
import { Caption, Frame, Panel, panelMapping } from '../../../support/SvgCompositeExtension';

class Group extends Shape {
  static override readonly type = 'g';
  override acceptsChildren(): boolean { return true; }
}

function factory(installed = true): ShapeFactory {
  const result = new ShapeFactory();
  for (const model of [Frame, Caption, Group]) result.register(model);
  if (installed) result.register(Panel);
  return result;
}

function sample(mapping: SvgShapeMapping = panelMapping) {
  const shapes = factory();
  const storage = new Map<string, string>();
  const files = {
    read: (path: string) => {
      if (!storage.has(path)) throw new EditorError(`cannot read file: ${path}`);
      return storage.get(path)!;
    },
    write: vi.fn((path: string, text: string) => { storage.set(path, text); }),
  };
  const writer = new SvgWriter([mapping]);
  const workspace = new Workspace(shapes, files, new SvgReader(shapes), writer, new AttributeHandlerRegistry());
  const document = new Document(100, 100);
  const panel = shapes.create(Panel.type, 'p') as Panel;
  const node = document.insert(panel);
  workspace.replace(document, 'original.svg');
  const client = new Client(workspace);
  for (const command of [ReadCommand, SaveCommand, MoveCommand, TreeCommand]) client.register(command);
  return { workspace, document, panel, node, client, writer, storage, files };
}

describe('SVG 复合类型完整读写', () => {
  it('私有部件、普通成员和嵌套模型一起保存，读回后再次写出一致', () => {
    const { workspace, document, panel, node, client, writer, storage } = sample();
    panel.setLabel('new <title> & text');
    const group = document.insert(new Group('members'), node);
    document.insert(Frame.parse('extra', new Map([['x', '7']])).shape, group);
    document.insert(new Panel('nested'), group);
    const resolve = vi.spyOn(workspace.attributeHandlerRegistry(), 'resolve');
    client.execute(['save', 'scene.svg']);
    const original = storage.get('scene.svg')!;
    expect(original).toContain('data-kind="test-panel"');
    expect(original).toContain('new &lt;title&gt; &amp; text');
    expect(client.execute(['read', 'scene.svg']).lines()).toEqual(['read scene.svg (4 elements)']);
    const restored = workspace.document();
    const model = restored.requireNode('p').value as Panel;
    expect(model).toBeInstanceOf(Panel);
    expect(model.captionShape().value('text')).toBe('new <title> & text');
    expect(restored.nodes().map((entry) => entry.value.id())).toEqual(['p', 'members', 'extra', 'nested']);
    expect(restored.requireNode('nested').value).toBeInstanceOf(Panel);
    expect(restored.findNode('p-frame')).toBeNull();
    expect(client.execute(['tree']).lines().some((line) => line.includes('p-frame'))).toBe(false);
    expect(writer.write(restored)).toBe(original);
    expect(resolve).not.toHaveBeenCalled();
    const frame = model.frameShape();
    client.execute(['move', 'p', '5', '6']);
    expect(frame.value('x')).toBe(6);
    expect(restored.requireNode('extra').value.value('x')).toBe(12);
    client.execute(['undo']);
    expect(model.frameShape()).toBe(frame);
    expect(frame.value('x')).toBe(1);
    expect(restored.requireNode('extra').value.value('x')).toBe(7);
  });

  it('卸载复合类型后按普通 g 读入，内部部件成为普通节点', () => {
    const { client, storage } = sample();
    client.execute(['save', 'scene.svg']);
    const { document } = new SvgReader(factory(false)).read(storage.get('scene.svg')!);
    expect(document.requireNode('p').value).toBeInstanceOf(Group);
    expect(document.nodes().map((entry) => entry.value.id())).toEqual(['p', 'p-frame', 'p-caption']);
  });

  it('非法复合读入保持文档、路径、对象身份及编辑历史', () => {
    const { workspace, document, panel, node, client, storage } = sample();
    client.execute(['move', 'p', '5', '6']);
    storage.set('bad.svg', '<svg><g id="broken" data-kind="test-panel"><rect id="broken-frame"/></g></svg>');
    expect(() => client.execute(['read', 'bad.svg'])).toThrow('invalid panel parts: broken');
    expect(workspace.document()).toBe(document);
    expect(workspace.path()).toBe('original.svg');
    expect(document.requireNode('p')).toBe(node);
    expect(node.value).toBe(panel);
    client.execute(['undo']);
    expect(panel.frameShape().value('x')).toBe(1);
    client.execute(['redo']);
    expect(panel.frameShape().value('x')).toBe(6);
  });

  it('私有部件与文档节点 id 冲突在写文件前拒绝，文件、路径和历史不变', () => {
    const { workspace, document, panel, client, storage, files } = sample({
      matches: panelMapping.matches,
      write: (shape) => ({ ...panelMapping.write(shape), children: [{ type: 'rect', attributes: [['id', 'external']] }] }),
    });
    document.insert(Frame.parse('external', new Map()).shape);
    storage.set('existing.svg', 'keep this file');
    client.execute(['move', 'p', '5', '6']);
    expect(() => client.execute(['save', 'existing.svg'])).toThrow('id already exists: external');
    expect(files.write).not.toHaveBeenCalled();
    expect(storage.get('existing.svg')).toBe('keep this file');
    expect(workspace.path()).toBe('original.svg');
    client.execute(['undo']);
    expect(panel.frameShape().value('x')).toBe(1);
  });

  it('映射只执行一次，再验证并格式化同一份结果', () => {
    const { document } = sample();
    const write = vi.fn(panelMapping.write);
    expect(new SvgWriter([{ matches: panelMapping.matches, write }]).write(document)).toContain('data-kind="test-panel"');
    expect(write).toHaveBeenCalledOnce();
  });

  it.each([
    [{ type: 'g', attributes: [['id', 'p']], children: [{ type: 'rect', attributes: [['id', 'p']] }] }, 'id already exists: p'],
    [{ type: 'g', attributes: [['id', 'bad id']] }, 'invalid id: bad id'],
    [{ type: 'g', attributes: [['id', 'p'], ['id', 'other']] }, 'multiple id attributes in SVG element'],
    [{ type: 'g', attributes: [['id', 'p']], content: 'text', children: [{ type: 'rect', attributes: [['id', 'child']] }] }, 'SVG element has both content and children: g'],
  ] satisfies [SvgElement, string][])('校验最终映射树，不只检查文档节点', (element, message) => {
    const { document } = sample();
    const writer = new SvgWriter([{ matches: () => true, write: () => element }]);
    expect(() => writer.write(document)).toThrow(message);
  });
});
