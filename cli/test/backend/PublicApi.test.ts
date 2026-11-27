import { createClientWithCommands } from '../support/Plugins';
import { describe, expect, it } from 'vitest';
import { AttributeHandlerRegistry, TreeRenderer, ShapeFactory, Document, SvgReader, SvgWriter, Receiver } from '../../src/backend';
import type { AttributeHandler, ShapeNode } from '../../src/backend';
import { Marker, MarkerAttributesHandler, NudgeMarkerCommand } from '../support/PublicExtension';
import SetCommand from '../../plugins/core/SetCommand';
// @ts-expect-error 注册用类型是工厂内部实现，不从公共入口导出。
import type { ShapeClass } from '../../src/backend';
// @ts-expect-error 也不能从实现模块单独导入内部注册类型。
import type { ShapeClass as InternalShapeClass } from '../../src/backend/receiver/document/shape/ShapeFactory';

/** 用公共入口构造并校验一个完整模型。 */
function marker(factory: ShapeFactory) {
  const model = factory.create('test-marker', 'marker');
  model.set('x', '1');
  model.set('y', '2');
  model.validate();
  return model;
}

describe('扩展公共入口', () => {
  it('仅用公共契约定义图形、注册、创建和读取节点，保留原模型引用', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const model = marker(factory);
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
    const receiver = new Receiver(factory, files, new SvgReader(factory), new SvgWriter(), new AttributeHandlerRegistry(), new TreeRenderer());
    const doc = new Document(100, 100);
    const model = marker(factory);
    const node = doc.insert(model);
    receiver.replace(doc);
    const client = createClientWithCommands(receiver, [NudgeMarkerCommand]);
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
    // 不同会话使用各自装配的命令表。
    expect(() => createClientWithCommands(receiver, []).execute(['nudge-marker', 'marker', '3'])).toThrow('unknown command: nudge-marker');
  });

  it('公共契约支持直接注册独立静态 Handler，通过内置 set 使用属性别名', () => {
    const factory = new ShapeFactory();
    factory.register(Marker);
    const handlers = new AttributeHandlerRegistry();
    const files = { read: () => '', write: () => {} };
    const receiver = new Receiver(factory, files, new SvgReader(factory), new SvgWriter(), handlers, new TreeRenderer());
    const doc = new Document(100, 100);
    const model = marker(factory);
    const node = doc.insert(model);
    receiver.replace(doc);
    const client = createClientWithCommands(receiver, [SetCommand]);
    expect(() => client.execute(['set', 'marker', 'horizontal', '4'])).toThrow('unknown attribute: horizontal');
    handlers.register(MarkerAttributesHandler satisfies AttributeHandler);
    expect(client.execute(['set', 'marker', 'horizontal', '4']).lines()).toEqual(['test-marker#marker updated: horizontal=4']);
    expect(client.execute(['undo']).lines()).toEqual(['test-marker#marker updated: horizontal=1']);
    client.execute(['redo']);
    expect(model.value('x')).toBe(4);
    expect(client.execute(['set', 'marker', 'left', '6']).lines()).toEqual(['test-marker#marker updated: left=6']);
    expect(model.value('x')).toBe(6);
    expect(doc.requireNode('marker')).toBe(node);
    expect(node.value).toBe(model);
    if (false) {
      // @ts-expect-error 静态契约缺少 display，不允许注册。
      handlers.register(class { static handlerName = 'invalid'; static matches() {}; static apply() {} });
      // @ts-expect-error 静态 Handler 无需也不允许实例化。
      new MarkerAttributesHandler();
    }
  });
});
