import { describe, expect, it } from 'vitest';
import { Document, Shape } from '../../../../src/backend';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import { createClientWithCommands, createHost } from '../../../support/Plugins';
import { Frame, Panel } from '../../../support/SvgCompositeExtension';

describe('Document 私有部件 id', () => {
  it('双向拒绝节点与私有部件冲突，失败不改变节点或关系', () => {
    const doc = new Document(100, 100);
    const panel = doc.insert(new Panel('p'));
    expect(() => doc.insert(Frame.parse('p-frame', new Map()).shape)).toThrow('id already exists: p-frame');
    expect(doc.nodes()).toEqual([panel]);
    const other = new Document(100, 100);
    const frame = other.insert(Frame.parse('p-frame', new Map()).shape);
    expect(() => other.insert(new Panel('p'))).toThrow('id already exists: p-frame');
    expect(other.nodes()).toEqual([frame]);
  });

  it('拒绝单个模型重复、非法或遗漏根 id 的声明', () => {
    for (const ids of [['p', 'p'], ['p', '1bad'], ['part']]) {
      class Invalid extends Shape {
        static override readonly type = 'invalid';
        override identifiers(): readonly string[] { return ids; }
      }
      const doc = new Document(100, 100);
      expect(() => doc.insert(new Invalid('p'))).toThrow();
      expect(doc.nodes()).toEqual([]);
    }
  });

  it('删除后释放部件 id，结构恢复前重新验证且失败不半恢复', () => {
    const doc = new Document(100, 100);
    let conflict = false;
    class MutableDeclaration extends Shape {
      static override readonly type = 'test';
      override identifiers(): readonly string[] { return conflict ? [this.id(), 'shared'] : [this.id()]; }
    }
    const first = doc.insert(new MutableDeclaration('a'));
    const second = doc.insert(new MutableDeclaration('b'));
    const snapshot = doc.captureStructure();
    doc.remove(second);
    conflict = true;
    expect(() => snapshot.restore()).toThrow('id already exists: shared');
    expect(doc.nodes()).toEqual([first]);
    conflict = false;
    snapshot.restore();
    expect(doc.nodes()).toEqual([first, second]);
    const panel = doc.insert(new Panel('p'));
    doc.remove(panel);
    expect(doc.insert(Frame.parse('p-frame', new Map()).shape).value.id()).toBe('p-frame');
  });

  it('create 通过 Document 在提交前拒绝冲突，保留 redo 并可重试', async () => {
    const { receiver, factory } = await createHost();
    factory.register(Panel);
    const doc = new Document(100, 100);
    receiver.replace(doc);
    const client = createClientWithCommands(receiver, [CreateCommand]);
    client.execute(['create', 'g', 'other']);
    client.execute(['undo']);
    const existing = doc.insert(receiver.createShape('g', 'p-frame'));
    expect(() => client.execute(['create', Panel.type, 'p'])).toThrow('id already exists: p-frame');
    expect(doc.findNode('p')).toBeNull();
    client.execute(['redo']);
    expect(doc.requireNode('other')).toBeDefined();
    doc.remove(existing);
    client.execute(['create', Panel.type, 'p']);
    expect(doc.requireNode('p').value).toBeInstanceOf(Panel);
  });
});
