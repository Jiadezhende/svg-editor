import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import Document from '../../../../src/backend/receiver/document/Document';
import type ShapeNode from '../../../../src/backend/receiver/document/ShapeNode';
import Group from '../../../../plugins/shapes/Group';
import Rect from '../../../../plugins/shapes/Rect';
import type Shape from '../../../../src/backend/receiver/document/shape/Shape';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import GroupCommand from '../../../../plugins/commands/GroupCommand';
import UngroupCommand from '../../../../plugins/commands/UngroupCommand';
import DeleteCommand from '../../../../plugins/commands/DeleteCommand';
import Invoker from '../../../../src/backend/invoker/Invoker';

const rect = (id: string) => new Rect(id, new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]]));

class ProtectedGroup extends Group {
  override checkRemove(shape: Shape): void {
    if (shape.id() === 'part') throw new Error('required part');
  }
}

async function workspaceWith(doc: Document): Promise<Workspace> {
  const workspace = (await createWorkspace());
  workspace.replace(doc);
  return workspace;
}

describe('Document 结构边界', () => {
  it('顶层与后代都登记归属；移除后释放，不能跨文档重复收纳', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const root = doc.insert(new Group('root'));
    const child = doc.insert(rect('part'), root);
    expect(root.parent()).toBeNull();
    expect(() => other.insert(root.value)).toThrow('shape already attached');
    expect(() => other.insert(child.value)).toThrow('shape already attached');
    doc.remove(root);
    expect(() => other.insert(root.value)).not.toThrow();
    expect(() => other.insert(child.value, other.requireNode('root'))).not.toThrow();
    expect(doc.children()).toEqual([]);
  });

  it('外部节点不能作为源或目标，同 id 的另一个对象不能冒充成员', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const local = doc.insert(new Group('same'));
    const foreign = other.insert(new Group('same'));
    expect(() => doc.insert(rect('a'), foreign)).toThrow('container is not in document');
    expect(() => doc.remove(foreign)).toThrow('shape is not in document');
    expect(() => doc.relocate(foreign, local)).toThrow('shape is not in document');
    expect(() => doc.relocate(local, foreign)).toThrow('container is not in document');
    expect(foreign.children()).toEqual([]); // 节点可只读访问；文档修改入口仍校验归属。
    expect(() => doc.indexOf(foreign)).toThrow('shape is not in document');
    expect(doc.children()).toEqual([local]);
  });

  it('换父级、根级迁移、同级排序保持节点身份，index 随位置变化', () => {
    const doc = new Document(100, 100);
    const root = doc.insert(new Group('g'));
    const a = doc.insert(rect('a'), root);
    const b = doc.insert(rect('b'), root);
    doc.relocate(a, root);
    expect(root.children()).toEqual([b, a]);
    expect(doc.indexOf(a)).toBe(1);
    doc.relocate(a, root, 0);
    expect(root.children()).toEqual([a, b]);
    doc.relocate(a, null, 0);
    expect(doc.children()).toEqual([a, root]);
    expect(a.parent()).toBeNull();
    expect(doc.requireNode('a')).toBe(a);
    expect(a.value.id()).toBe('a');
  });

  it('循环与非法迁移索引在摘除之前拒绝，原关系不变', () => {
    const doc = new Document(100, 100);
    const outer = doc.insert(new Group('outer'));
    const inner = doc.insert(new Group('inner'), outer);
    const a = doc.insert(rect('a'), outer);
    expect(() => doc.relocate(outer, inner)).toThrow('itself or its descendant');
    expect(() => doc.relocate(inner, inner)).toThrow('itself or its descendant');
    for (const index of [-1, 0.5, 2, Infinity, NaN]) {
      expect(() => doc.relocate(a, outer, index)).toThrow('invalid child index');
      expect(outer.children()).toEqual([inner, a]);
    }
    expect(inner.parent()).toBe(outer);
  });

  it('非法插入位置或叶子目标失败，不登记候选 Shape', () => {
    const doc = new Document(100, 100);
    const root = doc.insert(new Group('g'));
    const leaf = doc.insert(rect('leaf'));
    const candidate = rect('candidate');
    for (const index of [-1, 0.5, 1, Infinity, NaN]) {
      expect(() => doc.insert(candidate, root, index)).toThrow('invalid child index');
      expect(doc.findNode('candidate')).toBeNull();
    }
    expect(() => doc.insert(candidate, leaf)).toThrow('not a container: leaf');
    expect(() => doc.insert(candidate, root, 0)).not.toThrow();
  });

  it('节点、文档子数组和 viewBox 不泄露可变结构引用', () => {
    const doc = new Document(100, 100);
    const root = doc.insert(new Group('g'));
    const a = doc.insert(rect('a'), root);
    (doc.children() as ShapeNode[]).length = 0;
    (root.children() as ShapeNode[]).length = 0;
    (root.children() as ShapeNode[]).push(root);
    (doc.viewBox() as unknown as number[])[2] = -1;
    expect(doc.children()).toEqual([root]);
    expect(root.children()).toEqual([a]);
    expect(doc.viewBox()[2]).toBe(100);
    expect(() => Object.assign(a, { value: new Group('replacement') })).toThrow();
    expect(a.value.id()).toBe('a');
  });

  it('模型移除规则由 Document 调用，整个分组仍可移动删除', () => {
    const doc = new Document(100, 100);
    const group = doc.insert(new ProtectedGroup('protected'));
    const part = doc.insert(rect('part'), group);
    const target = doc.insert(new Group('target'));
    expect(() => doc.remove(part)).toThrow('required part');
    expect(() => doc.relocate(part, null)).toThrow('required part');
    doc.relocate(group, target);
    expect(part.parent()).toBe(group);
    doc.remove(group);
    expect(doc.findNode('part')).toBeNull();
  });

  it('跨文档归属冲突使快照恢复整体失败，不破坏两份文档', () => {
    const doc = new Document(100, 100);
    const other = new Document(100, 100);
    const root = doc.insert(new Group('g'));
    const a = doc.insert(rect('a'), root);
    const saved = doc.captureStructure();
    doc.remove(root);
    const replacement = doc.insert(new Group('replacement'));
    const foreign = other.insert(a.value);
    expect(() => saved.restore()).toThrow('shape already attached: a');
    expect(doc.children()).toEqual([replacement]);
    expect(other.requireNode('a')).toBe(foreign);
    other.remove(foreign);
    saved.restore();
    expect(doc.requireNode('a')).toBe(a);
    expect(a.parent()).toBe(root);
  });

  it('分组预检查失败，不创建空组或移动前面的成员', async () => {
    const doc = new Document(100, 100);
    const a = doc.insert(rect('a'));
    const protectedNode = doc.insert(new ProtectedGroup('protected'));
    const part = doc.insert(rect('part'), protectedNode);
    const command = new GroupCommand((await workspaceWith(doc)), ['new', 'a', 'part']);
    expect(() => command.execute()).toThrow('required part');
    expect(doc.children()).toEqual([a, protectedNode]);
    expect(doc.findNode('new')).toBeNull();
    expect(part.parent()).toBe(protectedNode);
  });

  it('解组目标规则失败，不提升前面的成员', async () => {
    class RestrictedParent extends Group {
      override checkInsert(shape: Shape): void {
        super.checkInsert(shape);
        if (shape.id() === 'b') throw new Error('member rejected');
      }
    }
    const doc = new Document(100, 100);
    const parent = doc.insert(new RestrictedParent('parent'));
    const group = doc.insert(new Group('group'), parent);
    const a = doc.insert(rect('a'), group);
    const b = doc.insert(rect('b'), group);
    await expect(async () => new UngroupCommand((await workspaceWith(doc)), ['group']).execute()).rejects.toThrow('member rejected');
    expect(parent.children()).toEqual([group]);
    expect(group.children()).toEqual([a, b]);
  });

  it('多步骤结构命令在已经修改之后失败，也恢复整个树及历史', async () => {
    let checks = 0;
    class FailingGroup extends Group {
      override checkRemove(_shape: Shape): void {
        checks += 1;
        // 前两次是预检查，第一次迁移成功，第二次迁移时失败。
        if (checks === 4) throw new Error('late failure');
      }
    }
    const doc = new Document(100, 100);
    const root = doc.insert(new FailingGroup('root'));
    const a = doc.insert(rect('a'), root);
    const b = doc.insert(rect('b'), root);
    const workspace = (await workspaceWith(doc));
    const invoker = new Invoker();
    const command = new GroupCommand(workspace, ['new', 'a', 'b']);
    expect(() => invoker.execute(command)).toThrow('late failure');
    expect(doc.children()).toEqual([root]);
    expect(root.children()).toEqual([a, b]);
    expect(doc.findNode('new')).toBeNull();
    expect(() => invoker.undo()).toThrow('nothing to undo');
  });

  it('删除撤销恢复原节点与模型；后续结构撤销不回滚模型属性', async () => {
    const doc = new Document(100, 100);
    const group = doc.insert(new Group('g'));
    const a = doc.insert(rect('a'), group);
    const workspace = (await workspaceWith(doc));
    const invoker = new Invoker();
    invoker.execute(new DeleteCommand(workspace, ['g']));
    invoker.undo();
    expect(doc.requireNode('g')).toBe(group);
    expect(doc.requireNode('a')).toBe(a);
    expect(doc.requireNode('a').value).toBe(a.value);
    a.value.set('fill', 'red');
    invoker.redo();
    invoker.undo();
    expect(doc.requireNode('a')).toBe(a);
    expect(a.value.value('fill')).toBe('red');
  });
});
