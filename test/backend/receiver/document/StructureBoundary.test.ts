import { describe, expect, it } from 'vitest';
import Document from '../../../../src/backend/receiver/document/Document';
import Group from '../../../../src/backend/receiver/document/shape/Group';
import Rect from '../../../../src/backend/receiver/document/shape/Rect';
import type Shape from '../../../../src/backend/receiver/document/shape/Shape';
import GroupCommand from '../../../../src/backend/command/impl/GroupCommand';
import UngroupCommand from '../../../../src/backend/command/impl/UngroupCommand';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';

const rect = (id: string) => new Rect(id, new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]]));

/** 必要部件只能随整个复合图形移动；约束属于模型。 */
class ProtectedGroup extends Group {
  constructor(id: string) {
    super(id);
    this.insert(rect(`${id}-part`));
  }

  override checkRemove(shape: Shape): void {
    if (shape.id() === `${this.id()}-part`) throw new Error('required part');
  }

}

describe('文档结构边界', () => {
  it('顶层 parent 为 null，仍禁止跨文档重复收纳和直接移入脱离文档的对象', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const root = new Group('root');
    const detached = new Group('detached');
    doc.add(root);
    expect(root.parent()).toBeNull();
    expect(() => other.add(root)).toThrow('shape already attached');
    expect(() => detached.insert(root)).toThrow('already attached');
    expect(() => root.relocate(detached)).toThrow('use Document');
    expect(() => root.detach()).toThrow('use Document');
    expect(doc.children()).toEqual([root]);
    expect(other.children()).toEqual([]);
    expect(detached.children()).toEqual([]);
  });

  it('移除顶层图形后释放文档归属，子树可以重新构建并加入另一文档', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const root = new Group('root');
    root.insert(rect('part'));
    doc.add(root);
    doc.remove(root);
    root.insert(rect('new'));
    other.add(root);
    expect(root.parent()).toBeNull();
    expect(doc.children()).toEqual([]);
    expect(other.shapes().map((shape) => shape.id())).toEqual(['root', 'part', 'new']);
    expect(other.requireShape('part').parent()).toBe(root);
    expect(() => root.insert(rect('blocked'))).toThrow('use Document');
  });

  it('顶层与嵌套迁移同步维护归属，不把 null parent 当作未入文档', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const a = new Group('a');
    const b = new Group('b');
    doc.add(a);
    doc.add(b);
    doc.relocate(b, a);
    expect(b.parent()).toBe(a);
    doc.relocate(b, null, 0);
    expect(b.parent()).toBeNull();
    expect(doc.children()).toEqual([b, a]);
    expect(() => other.add(b)).toThrow('shape already attached');
    doc.remove(b);
    other.add(b);
    expect(doc.find('b')).toBeNull();
    expect(other.find('b')).toBe(b);
  });

  it('新增子树内部重复 id 时整棵拒绝，保留候选子树', () => {
    const doc = new Document(100, 100);
    const candidate = new Group('candidate');
    candidate.insert(rect('same'));
    candidate.insert(rect('same'));
    expect(() => doc.add(candidate, null)).toThrow('id already exists: same');
    expect(doc.children()).toEqual([]);
    expect(candidate.parent()).toBeNull();
    expect(candidate.children()).toHaveLength(2);
  });

  it('检查候选后代与现有文档的 id 冲突，包括 insert 入口', () => {
    const doc = new Document(100, 100);
    doc.add(rect('used'), null);
    const candidate = new Group('candidate');
    candidate.insert(rect('used'));
    expect(() => doc.insert(candidate)).toThrow('id already exists: used');
    expect(doc.shapes().map((s) => s.id())).toEqual(['used']);
  });

  it('拒绝目标不属于文档，以及属于另一文档的图形', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const foreign = new Group('foreign');
    other.add(foreign, null);
    expect(() => doc.add(rect('a'), foreign)).toThrow('container is not in document');
    expect(() => doc.add(foreign, null)).toThrow('shape already attached');
    expect(() => doc.relocate(foreign, null)).toThrow('shape is not in document');
    expect(() => doc.remove(foreign)).toThrow('shape is not in document');
    expect(foreign.parent()).toBeNull();
    expect(other.find('foreign')).toBe(foreign);
  });

  it('已入文档的容器不能绕过 Document 修改，脱离文档后可以构建', () => {
    const doc = new Document(100, 100);
    const group = new Group('group');
    const part = rect('part');
    group.insert(part);
    doc.add(group, null);
    expect(() => group.insert(rect('new'))).toThrow('use Document');
    expect(() => group.remove(part)).toThrow('use Document');
    expect(() => part.relocate(group)).toThrow('use Document');
    expect(() => part.detach()).toThrow('use Document');
    expect(() => rect('new').attachTo(group)).toThrow('use Document');
    doc.remove(group);
    group.insert(rect('new'));
    expect(group.children()).toHaveLength(2);
  });

  it('向已入文档的目标直接迁移失败，不摘除原子树', () => {
    const doc = new Document(100, 100);
    const target = new Group('target');
    doc.add(target, null);
    const source = new Group('source');
    const part = rect('part');
    source.insert(part);
    expect(() => part.relocate(target)).toThrow('use Document');
    expect(source.children()).toEqual([part]);
  });

  it('拒绝循环迁移且保持父子关系；脱离文档的构建同样拒绝循环', () => {
    const doc = new Document(100, 100);
    const outer = new Group('outer');
    const inner = new Group('inner');
    outer.insert(inner);
    expect(() => inner.insert(outer)).toThrow('itself or its descendant');
    doc.add(outer, null);
    expect(() => doc.relocate(outer, inner)).toThrow('itself or its descendant');
    expect(() => doc.relocate(inner, inner)).toThrow('itself or its descendant');
    expect(outer.parent()).toBeNull();
    expect(inner.requireParent()).toBe(outer);
  });

  it('迁移索引非法时不摘除图形，同父级索引按摘除后的序列计算', () => {
    const doc = new Document(100, 100);
    const a = rect('a');
    const b = rect('b');
    doc.add(a, null);
    doc.add(b, null);
    for (const index of [-1, 0.5, 2, Infinity]) {
      expect(() => doc.relocate(a, null, index)).toThrow('invalid child index');
      expect(doc.children()).toEqual([a, b]);
    }
    doc.relocate(a, null, 1);
    expect(doc.children()).toEqual([b, a]);
  });

  it('必要部件不能删除或迁移，整个复合对象可迁移和删除', () => {
    const doc = new Document(100, 100);
    const composite = new ProtectedGroup('composite');
    doc.add(composite, null);
    const part = doc.requireShape('composite-part');
    expect(() => doc.remove(part)).toThrow('required part');
    expect(() => doc.relocate(part, null)).toThrow('required part');
    const target = new Group('target');
    doc.add(target, null);
    doc.relocate(composite, target);
    expect(part.requireParent()).toBe(composite);
    doc.remove(composite);
    expect(doc.find(part.id())).toBeNull();
  });

  it('分组先检查全部成员，后一个必要部件失败不留下新容器或迁移前一个成员', () => {
    const doc = new Document(100, 100);
    const a = rect('a');
    const composite = new ProtectedGroup('composite');
    doc.add(a, null);
    doc.add(composite, null);
    const workspace = new Workspace();
    workspace.replace(doc);
    expect(() => new GroupCommand(workspace, ['new', 'a', 'composite-part']).execute()).toThrow('required part');
    expect(doc.children()).toEqual([a, composite]);
    expect(doc.find('new')).toBeNull();
  });

  it('解组遵守必要部件的移除约束，失败保留原树', () => {
    const doc = new Document(100, 100);
    const outer = new Group('outer');
    const composite = new ProtectedGroup('composite');
    outer.insert(composite);
    doc.add(outer, null);
    const workspace = new Workspace();
    workspace.replace(doc);
    expect(() => new UngroupCommand(workspace, ['composite']).execute()).toThrow('required part');
    expect(composite.requireParent()).toBe(outer);
    expect(composite.children()).toHaveLength(1);
  });

  it('返回的子节点数组和 viewBox 不能修改模型状态', () => {
    const doc = new Document(100, 100);
    const group = new Group('g');
    group.insert(rect('part'));
    doc.add(group, null);
    (doc.children() as Shape[]).length = 0;
    (group.children() as Shape[]).length = 0;
    (doc.viewBox() as unknown as number[])[2] = -1;
    expect(doc.shapes()).toHaveLength(2);
    expect(doc.viewBox()[2]).toBe(100);
  });

  it('解组先检查全部目标接收规则，后一个成员失败时不提升前一个成员', () => {
    class RestrictedParent extends Group {
      override checkInsert(shape: Shape): void {
        super.checkInsert(shape);
        if (shape.id() === 'b') throw new Error('member rejected');
      }
    }
    const doc = new Document(100, 100);
    const parent = new RestrictedParent('parent');
    const group = new Group('group');
    const a = rect('a');
    const b = rect('b');
    group.insert(a);
    group.insert(b);
    parent.insert(group);
    doc.add(parent, null);
    const workspace = new Workspace();
    workspace.replace(doc);
    expect(() => new UngroupCommand(workspace, ['group']).execute()).toThrow('member rejected');
    expect(parent.children()).toEqual([group]);
    expect(group.children()).toEqual([a, b]);
    expect(a.parent()).toBe(group);
  });
});
