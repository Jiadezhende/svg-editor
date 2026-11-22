import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Command, CommandResult, Document, Shape, TreeDecorator } from '../../src/backend';
import type { ExtensionContext, ShapeNode } from '../../src/backend';
import { assembleSources } from '../../src/host/PluginHost';
import { assemblePlugins, createHost } from '../support/Plugins';
import type { PluginRegistration } from '../support/Plugins';
import { Panel, panelMapping } from '../support/SvgCompositeExtension';
import { TestChangedDecorator } from '../support/PublicTreeExtension';

class Hello extends Command {
  static override readonly command: string = 'test-hello';
  static override readonly usage = 'test-hello';
  execute(): CommandResult { return new CommandResult().line('hello from plugin'); }
}
class LabelHandler {
  static readonly handlerName = 'test-panel-label';
  static matches(shape: Shape, key: string): boolean { return shape instanceof Panel && key === 'label'; }
  static apply(shape: Shape, _key: string, token: string): void { (shape as Panel).setLabel(token); }
  static display(shape: Shape): string | null { return (shape as Panel).captionShape().display('text'); }
}
class PanelType extends TreeDecorator {
  static override readonly decoratorName = 'test-panel-type';
  protected override tag(node: ShapeNode | null): string | null { return node?.value instanceof Panel ? '(panel)' : null; }
}
const all: PluginRegistration = {
  name: 'all',
  contributes: { shapes: [Panel.type], commands: [Hello.command], attributes: [LabelHandler.handlerName], decorators: [TestChangedDecorator.decoratorName, PanelType.decoratorName] },
  plugin: { activate(context) {
    context.registerShape(Panel, panelMapping);
    context.registerCommand(Hello);
    context.registerAttributeHandler(LabelHandler);
    context.registerTreeDecorator(TestChangedDecorator);
    context.registerTreeDecorator(PanelType);
  } },
};
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('svg-assembly-')) throw new Error('unsafe cleanup target');
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('插件暂存与原子装配', () => {
  it('装配四类扩展及附属 SVG 映射，实际参与命令、属性、树和读写', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'svg-assembly-'));
    directories.push(dir);
    const host = await createHost([all]);
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['core', 'all']);
    host.client.execute(['init']);
    host.client.execute(['create', Panel.type, 'p']);
    expect(host.client.execute(['test-hello']).lines()).toEqual(['hello from plugin']);
    host.client.execute(['undo']);
    expect(host.workspace.document().findNode('p')).toBeNull();
    host.client.execute(['redo']);
    host.client.execute(['set', 'p', 'label', 'changed']);
    expect(host.client.execute(['tree']).lines()).toEqual(['svg (800x600) *', '└── test-panel#p * (panel)']);
    const path = join(dir, 'panel.svg');
    host.client.execute(['save', path]);
    expect(readFileSync(path, 'utf8')).toContain('data-kind="test-panel"');
    expect(host.client.execute(['tree']).lines()[1]).toBe('└── test-panel#p (panel)');
    host.client.execute(['read', path]);
    expect(host.workspace.document().requireNode('p').value).toBeInstanceOf(Panel);
    expect((host.workspace.document().requireNode('p').value as Panel).captionShape().value('text')).toBe('changed');
  });

  it('激活失败丢弃全部暂存贡献及映射，之后同名贡献可正常装配', async () => {
    const failed: PluginRegistration = { ...all, name: 'failed', plugin: { activate(context) { all.plugin.activate(context); throw new Error('broken activation'); } } };
    const rejected = await assemblePlugins([failed]);
    expect(rejected.workspace.shapes().has(Panel.type)).toBe(false);
    expect(() => rejected.client.execute([Hello.command])).toThrow('unknown command');
    const doc = new Document(100, 100);
    doc.insert(new Panel('p'));
    expect(rejected.workspace.svgWriter().write(doc)).not.toContain('data-kind');
    expect(rejected.workspace.attributeHandlerRegistry().resolve(new Panel('p'), 'label')).toBeNull();
    const continued = await assemblePlugins([failed, all]);
    expect(continued.plugins).toEqual(['all']);
    expect(continued.errors[0]).toContain('plugin failed to activate: failed');
    expect(continued.workspace.shapes().has(Panel.type)).toBe(true);
  });

  it('贡献声明不一致拒绝整个插件，包括其 SVG 映射', async () => {
    const host = await assemblePlugins([{ ...all, contributes: {} }]);
    expect(host.errors[0]).toContain('plugin manifest mismatch: all');
    expect(host.plugins).toEqual([]);
    expect(host.workspace.shapes().has(Panel.type)).toBe(false);
  });

  it.each(['shapes', 'commands', 'attributes', 'decorators'] as const)('跨插件重复 %s 名称时拒绝后者，保留先前插件', async (category) => {
    const duplicate: PluginRegistration = {
      name: 'duplicate', contributes: { [category]: all.contributes[category] },
      plugin: { activate(context) {
        if (category === 'shapes') context.registerShape(Panel, panelMapping);
        if (category === 'commands') context.registerCommand(Hello);
        if (category === 'attributes') context.registerAttributeHandler(LabelHandler);
        if (category === 'decorators') {
          context.registerTreeDecorator(TestChangedDecorator);
          context.registerTreeDecorator(PanelType);
        }
      } },
    };
    const host = await assemblePlugins([all, duplicate]);
    expect(host.plugins).toEqual(['all']);
    expect(host.errors[0]).toContain(`duplicate registration: ${category}/`);
    expect(host.client.execute([Hello.command]).lines()).toEqual(['hello from plugin']);
  });

  it('重复内置命令及插件名同样拒绝，未接纳命令不参与 help', async () => {
    class Reserved extends Hello { static override readonly command = 'help'; }
    const host = await assemblePlugins([
      all, all,
      { name: 'reserved', contributes: { commands: ['help'] }, plugin: { activate: (context) => context.registerCommand(Reserved) } },
    ]);
    expect(host.errors).toEqual(['duplicate registration: plugins/all', 'duplicate registration: commands/help']);
    expect(host.plugins).toEqual(['all']);
    expect(host.client.execute(['help']).lines().filter((line) => line === 'test-hello')).toHaveLength(1);
  });

  it('同一个插件可以提供已有命令协议支持的多个互斥形式', async () => {
    class Empty extends Hello {
      static override readonly command = 'choice';
      static override accepts(args: readonly string[]): boolean { return args.length === 0; }
    }
    class WithArgument extends Empty {
      static override accepts(args: readonly string[]): boolean { return args.length === 1; }
      override execute(): CommandResult { return new CommandResult().line('argument form'); }
    }
    const host = await assemblePlugins([{ name: 'forms', contributes: { commands: ['choice'] }, plugin: { activate(context) { context.registerCommand(Empty); context.registerCommand(WithArgument); } } }]);
    expect(host.errors).toEqual([]);
    expect(host.client.execute(['choice']).lines()).toEqual(['hello from plugin']);
    expect(host.client.execute(['choice', 'x']).lines()).toEqual(['argument form']);
  });

  it('装饰器构造失败不能污染已接纳的会话或 writer', async () => {
    class Broken extends TreeDecorator {
      static override readonly decoratorName = 'broken';
      constructor(...args: ConstructorParameters<typeof PanelType>) { super(...args); throw new Error('constructor failed'); }
      protected override tag(): null { return null; }
    }
    const host = await assemblePlugins([{ name: 'broken', contributes: { shapes: [Panel.type], decorators: ['broken'] }, plugin: { activate(context) { context.registerShape(Panel, panelMapping); context.registerTreeDecorator(Broken); } } }, all]);
    expect(host.plugins).toEqual(['all']);
    expect(host.errors[0]).toContain('constructor failed');
  });

  it('支持异步激活，完成后关闭暂存入口，不泄漏可写注册表', async () => {
    let saved: ExtensionContext | undefined;
    const host = await assemblePlugins([{ name: 'async', contributes: { commands: [Hello.command] }, plugin: { async activate(context) { saved = context; await Promise.resolve(); context.registerCommand(Hello); } } }]);
    expect(host.errors).toEqual([]);
    expect(() => saved!.registerCommand(Hello)).toThrow('plugin registration is closed');
    if (false) {
      // @ts-expect-error 插件上下文不开放当前会话及内部注册表。
      saved!.workspace;
    }
  });

  it('缺少具名 activate 导出或模块依赖加载失败均报告并继续', async () => {
    const messages: string[] = [];
    const host = await assembleSources([
      { name: 'no-activate', module: 'no-activate.mjs', contributes: {}, load: async () => ({}) },
      { name: 'dependency', module: 'dependency.mjs', contributes: {}, load: async () => { throw new Error('missing nested dependency'); } },
      { name: 'good', module: 'good', contributes: all.contributes, load: async () => all.plugin },
    ], (message) => messages.push(message));
    expect(host.plugins).toEqual(['good']);
    expect(messages[0]).toBe('error: plugin must export activate(context): no-activate.mjs');
    expect(messages[1]).toContain('error: plugin failed to load: dependency');
    expect(messages[1]).not.toContain('plugin not found');
  });
});
