import { describe, expect, it } from 'vitest';
import { AttributeHandlers, Client, ShapeFactory, Document, SvgReader, SvgWriter, Workspace } from '../../src/backend';
import type { ShapeNode } from '../../src/backend';
import { Marker, NudgeMarkerCommand } from '../support/PublicExtension';
// @ts-expect-error 注册用类型是工厂内部实现，不从公共入口导出。
import type { ShapeClass } from '../../src/backend';
// @ts-expect-error 也不能从实现模块单独导入内部注册类型。
import type { ShapeClass as InternalShapeClass } from '../../src/backend/receiver/document/shape/ShapeFactory';

describe('扩展公共入口', () => {
  it('仅用公共契约定义图形、注册、创建和读取节点，保留原模型引用', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const model = factory.create('test-marker', 'marker', new Map([['x', 1], ['y', 2]]));
    const doc = new Document(100, 100);
    const node = doc.insert(model);
    expect(doc.requireNode('marker')).toBe(node);
    expect(node.value).toBe(model);
    expect(node.value).toBeInstanceOf(Marker);
    expect(doc.findNode('missing')).toBeNull();
    expect(() => doc.requireNode('missing')).toThrow('no such shape: missing');
    expect(node.children()).toEqual([]);
    if (false) {
      // @ts-expect-error ShapeNode 只作为只读类型导出，不开放构造入口。
      new ShapeNode(model, () => ({ parent: null, children: [] }));
      // @ts-expect-error 不再提供返回模型的重复查找入口。
      doc.requireShape('marker');
      // @ts-expect-error 不公开内部插入预检查。
      doc.checkInsert(model);
    }
  });

  it('独立扩展的模型与编辑命令可装配，撤销重做保持节点和模型身份', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const files = { read: () => '', write: () => {} };
    const workspace = new Workspace(factory, files, new SvgReader(factory), new SvgWriter(), new AttributeHandlers());
    const doc = new Document(100, 100);
    const model = factory.create('test-marker', 'marker', new Map([['x', 1], ['y', 2]]));
    const node = doc.insert(model);
    workspace.replace(doc);
    const client = new Client(workspace);
    expect(() => client.execute(['nudge-marker', 'marker', '3'])).toThrow('unknown command: nudge-marker');
    client.register(NudgeMarkerCommand);
    expect(client.execute(['help']).lines()).toContain('nudge-marker <id> <dx>');
    expect(client.execute(['nudge-marker', 'marker', '3']).lines()).toEqual(['test-marker#marker nudged']);
    expect(model.value('x')).toBe(4);
    for (let i = 0; i < 2; i++) {
      expect(client.execute(['undo']).lines()).toEqual(['test-marker#marker restored']);
      expect(model.value('x')).toBe(1);
      client.execute(['redo']);
      expect(model.value('x')).toBe(4);
      expect(doc.requireNode('marker')).toBe(node);
      expect(node.value).toBe(model);
    }
    // 注册属于 Client 实例，不自动传播给另一个分发器。
    expect(() => new Client(workspace).execute(['nudge-marker', 'marker', '3'])).toThrow('unknown command: nudge-marker');
  });
});
