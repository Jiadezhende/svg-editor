import { describe, expect, it, vi } from 'vitest';
import { AttributeHandlerRegistry, Client, SvgReader, SvgWriter, TreeDecorator, TreeRenderer, Workspace } from '../../../src/backend';
import type { TreeSuccess } from '../../../src/backend';
import { createShapeFactory } from '../../support/Plugins';
import InitCommand from '../../../plugins/commands/InitCommand';
import CreateCommand from '../../../plugins/commands/CreateCommand';
import ReadCommand from '../../../plugins/commands/ReadCommand';
import SaveCommand from '../../../plugins/commands/SaveCommand';
import TreeCommand from '../../../plugins/commands/TreeCommand';
import CanvasResizeCommand from '../../../plugins/commands/CanvasResizeCommand';

async function session(broken = false) {
  const events: TreeSuccess[] = [];
  class Recording extends TreeDecorator {
    static override readonly decoratorName = 'recording';
    protected override tag(): null { return null; }
    override onSuccess(event: TreeSuccess): void {
      events.push(event);
      if (broken) throw new Error('notification failed');
    }
  }
  const factory = (await createShapeFactory());
  const files = { read: vi.fn(() => '<svg/>'), write: vi.fn((_path: string, _text: string) => {}) };
  const workspace = new Workspace(factory, files, new SvgReader(factory), new SvgWriter(), new AttributeHandlerRegistry(), new TreeRenderer([Recording]));
  const client = new Client(workspace);
  for (const command of [InitCommand, CreateCommand, ReadCommand, SaveCommand, TreeCommand, CanvasResizeCommand]) client.register(command);
  return { client, workspace, files, events };
}

describe('成功后的树展示通知', () => {
  it('编辑、undo/redo、替换、保存和画布修改成功后发布，查询不发布', async () => {
    const { client, events } = (await session());
    client.execute(['init']);
    client.execute(['create', 'g', 'g']);
    client.execute(['tree']);
    client.execute(['undo']);
    client.execute(['redo']);
    client.execute(['save', 'memory.svg']);
    client.execute(['canvas', '200', '300']);
    client.execute(['read', 'other.svg']);
    expect(events.map((event) => event.kind)).toEqual(['replace', 'edit', 'undo', 'redo', 'save', 'edit', 'replace']);
    expect(events[1].nodes.map((node) => node.value.id())).toEqual(['g']);
    expect(events[5].canvas).toEqual({ width: 200, height: 300 });
  });

  it('编辑、读写及 undo/redo 失败不通知，失败后仍可重试', async () => {
    const { client, workspace, files, events } = (await session());
    client.execute(['init']);
    client.execute(['create', 'g', 'g']);
    const before = events.length;
    expect(() => client.execute(['create', 'g', 'g'])).toThrow('id already exists: g');
    files.read.mockReturnValue('<invalid/>');
    expect(() => client.execute(['read', 'bad.svg'])).toThrow('invalid svg');
    files.write.mockImplementationOnce(() => { throw new Error('write failed'); });
    expect(() => client.execute(['save', 'bad.svg'])).toThrow('write failed');
    expect(events).toHaveLength(before);
    client.execute(['undo']);
    const conflict = workspace.document().insert(workspace.shapes().create('g', 'g'));
    expect(() => client.execute(['redo'])).toThrow('id already exists: g');
    expect(events).toHaveLength(before + 1);
    workspace.document().remove(conflict);
    client.execute(['redo']);
    client.execute(['save', 'good.svg']);
    const after = events.length;
    expect(() => client.execute(['undo'])).toThrow('undo not allowed');
    expect(events).toHaveLength(after);
  });

  it('观察者错误只增加警告，已提交的操作及历史保持成功', async () => {
    const { client, workspace } = (await session(true));
    client.execute(['init']);
    const result = client.execute(['create', 'g', 'g']);
    expect(result.warnings()).toEqual(['tree decorator recording: notification failed']);
    expect(workspace.document().requireNode('g').value.id()).toBe('g');
    client.execute(['undo']);
    expect(workspace.document().findNode('g')).toBeNull();
  });
});
