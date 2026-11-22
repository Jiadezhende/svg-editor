import { describe, expect, it, vi } from 'vitest';
import { Command, CommandResult, Shape } from '../../src/backend';
import { assemblePlugins, corePlugin, createHost } from '../support/Plugins';
import type { PluginRegistration } from '../support/Plugins';
import { Panel, panelMapping } from '../support/SvgCompositeExtension';

class PanelAttributes {
  static readonly handlerName: string = 'panel-attributes';
  static matches(shape: Shape, key: string): boolean { return shape instanceof Panel && ['label', 'title'].includes(key); }
  static apply(shape: Shape, _key: string, token: string): void {
    const panel = shape as Panel;
    panel.setLabel(token);
    panel.frameShape().set('fill', token);
    if (token === 'fail') throw new Error('partial failure');
  }
  static display(shape: Shape): string | null {
    const panel = shape as Panel;
    if (panel.captionShape().value('text') === 'display-fail') throw new Error('display failure');
    return panel.captionShape().display('text');
  }
}
class LaterAttributes extends PanelAttributes {
  static override readonly handlerName = 'later-attributes';
  static override apply(): void { throw new Error('later handler must not run'); }
}
const panelPlugin: PluginRegistration = {
  name: 'panel', contributes: { shapes: [Panel.type], attributes: [PanelAttributes.handlerName, LaterAttributes.handlerName] },
  classes: {
    shapes: [{ model: Panel, mapping: panelMapping }],
    attributes: [PanelAttributes, LaterAttributes],
  },
};

async function panelSession() {
  const host = await createHost([panelPlugin]);
  host.client.execute(['init']);
  host.client.execute(['create', Panel.type, 'p']);
  return { ...host, panel: host.receiver.document().requireNode('p').value as Panel };
}

describe('统一插件边界', () => {
  it('空装配只保留五个框架入口，不隐式注册图形或用例命令', () => {
    const host = assemblePlugins([]);
    expect(host.plugins).toEqual([]);
    expect(host.client.execute(['help']).lines()).toEqual(['help', 'undo', 'redo', 'exit', 'quit']);
    expect(host.factory.has('rect')).toBe(false);
    expect(() => host.client.execute(['init'])).toThrow('unknown command');
    expect(() => host.client.execute(['undo'])).toThrow('nothing to undo');
    expect(() => host.client.execute(['redo'])).toThrow('nothing to redo');
    host.client.execute(['exit']);
    expect(host.client.isExitRequested()).toBe(true);
    const other = assemblePlugins([]);
    other.client.execute(['quit']);
    expect(other.client.isExitRequested()).toBe(true);
  });

  it.each(['help', 'undo', 'redo', 'exit', 'quit'])('插件不能占用框架入口 %s', (name) => {
    class Reserved extends Command {
      static override readonly command = name;
      static override readonly usage = name;
      execute(): CommandResult { return new CommandResult(); }
    }
    const host = assemblePlugins([{ name: 'reserved', contributes: { commands: [name] }, classes: { commands: [Reserved] } }]);
    expect(host.errors).toEqual([`duplicate registration: commands/${name}`]);
    expect(host.plugins).toEqual([]);
  });

  it('核心包同时提供图形和命令，重复注册时保留已接纳的核心包', async () => {
    const core = await corePlugin();
    const host = assemblePlugins([core, { ...core, name: 'duplicate-core' }]);
    expect(host.plugins).toEqual(['core']);
    expect(host.errors).toHaveLength(1);
    expect(host.errors[0]).toContain('duplicate registration: shapes/');
    host.client.execute(['init']);
    host.client.execute(['create', 'g', 'g']);
    expect(host.receiver.document().requireNode('g').value.type()).toBe('g');
  });

  it('同包模型与 Handler 接入 set，别名优先且多部件整体撤销重做', async () => {
    const { client, panel, receiver } = await panelSession();
    expect(client.execute(['set', 'p', 'title', 'red']).lines()[0]).toContain('title="red"');
    for (let i = 0; i < 3; i++) {
      expect(panel.frameShape().value('fill')).toBe('red');
      expect(panel.captionShape().value('text')).toBe('red');
      client.execute(['undo']);
      expect(panel.frameShape().value('fill')).toBeNull();
      expect(panel.captionShape().value('text')).toBe('hello');
      client.execute(['redo']);
      expect(receiver.document().requireNode('p').value).toBe(panel);
    }
    client.execute(['set', 'p', 'stroke', 'blue']);
    expect(panel.value('stroke')).toBe('blue');
    expect(() => client.execute(['set', 'p', 'unknown', 'x'])).toThrow('unknown attribute');
  });

  it.each(['fail', 'display-fail'])('命中后 %s 恢复私有部件并保留 redo，不调用后续 Handler', async (token) => {
    const { client, panel } = await panelSession();
    client.execute(['set', 'p', 'label', 'red']);
    client.execute(['undo']);
    expect(() => client.execute(['set', 'p', 'title', token])).toThrow(token === 'fail' ? 'partial failure' : 'display failure');
    expect(panel.captionShape().value('text')).toBe('hello');
    expect(panel.frameShape().value('fill')).toBeNull();
    client.execute(['redo']);
    expect(panel.captionShape().value('text')).toBe('red');
  });

  it('redo 部分失败保持原撤销记录并可重试', async () => {
    const { client, panel } = await panelSession();
    client.execute(['set', 'p', 'label', 'red']);
    client.execute(['undo']);
    const spy = vi.spyOn(PanelAttributes, 'apply').mockImplementationOnce((shape) => {
      (shape as Panel).setLabel('partial');
      throw new Error('retry');
    });
    try {
      expect(() => client.execute(['redo'])).toThrow('retry');
      expect(panel.captionShape().value('text')).toBe('hello');
      client.execute(['redo']);
      expect(panel.captionShape().value('text')).toBe('red');
      client.execute(['undo']);
      expect(panel.captionShape().value('text')).toBe('hello');
    } finally { spy.mockRestore(); }
  });
});
