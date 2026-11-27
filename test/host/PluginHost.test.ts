import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Command, CommandResult, Shape, TreeDecorator } from '../../src/backend';
import type { ShapeView } from '../../src/backend';
import { assemblePlugins, createHost } from '../support/Plugins';
import type { PluginRegistration } from '../support/Plugins';
import { Panel } from '../support/SvgCompositeExtension';
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
  protected override tag(node: ShapeView | null): string | null { return node?.type === Panel.type ? '(panel)' : null; }
}
const all: PluginRegistration = {
  name: 'all',
  contributes: { shapes: [Panel.type], commands: [Hello.command], attributes: [LabelHandler.handlerName], decorators: [TestChangedDecorator.decoratorName, PanelType.decoratorName] },
  classes: {
    shapes: [Panel],
    commands: [Hello],
    attributes: [LabelHandler],
    decorators: [TestChangedDecorator, PanelType],
  },
};
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('svg-assembly-')) throw new Error('unsafe cleanup target');
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('插件暂存与原子装配', () => {
  it('装配四类扩展及模型写出，实际参与命令、属性、树和读写', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'svg-assembly-'));
    directories.push(dir);
    const host = await createHost([all]);
    expect(host.client).not.toHaveProperty('register');
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['core', 'all']);
    host.client.execute(['init']);
    host.client.execute(['create', Panel.type, 'p']);
    expect(host.client.execute(['test-hello']).lines()).toEqual(['hello from plugin']);
    host.client.execute(['undo']);
    expect(host.receiver.document().findNode('p')).toBeNull();
    host.client.execute(['redo']);
    host.client.execute(['set', 'p', 'label', 'changed']);
    expect(host.client.execute(['tree']).lines()).toEqual(['svg (800x600) *', '└── g#p * (panel)']);
    const path = join(dir, 'panel.svg');
    host.client.execute(['save', path]);
    expect(readFileSync(path, 'utf8')).toContain('data-kind="test-panel"');
    expect(host.client.execute(['tree']).lines()[1]).toBe('└── g#p (panel)');
    host.client.execute(['read', path]);
    expect(host.receiver.document().requireNode('p').value).toBeInstanceOf(Panel);
    expect((host.receiver.document().requireNode('p').value as Panel).captionShape().value('text')).toBe('changed');
  });

  it('命令注册失败时丢弃整包，之后同名扩展可正常装配', () => {
    class Reserved extends Hello { static override readonly command = 'help'; }
    const failed: PluginRegistration = {
      name: 'failed',
      contributes: { ...all.contributes, commands: [Hello.command, Reserved.command] },
      classes: { ...all.classes, commands: [Hello, Reserved] },
    };
    const rejected = assemblePlugins([failed]);
    expect(rejected.factory.has(Panel.type)).toBe(false);
    expect(() => rejected.client.execute([Hello.command])).toThrow('unknown command');
    expect(rejected.handlers.resolve(new Panel('p'), 'label')).toBeNull();
    const continued = assemblePlugins([failed, all]);
    expect(continued.plugins).toEqual(['all']);
    expect(continued.errors).toEqual(['duplicate registration: commands/help']);
    expect(continued.factory.has(Panel.type)).toBe(true);
  });

  it('贡献声明不一致拒绝整个插件', () => {
    const host = assemblePlugins([{ ...all, contributes: {} }]);
    expect(host.errors[0]).toContain('plugin manifest mismatch: all');
    expect(host.plugins).toEqual([]);
    expect(host.factory.has(Panel.type)).toBe(false);
  });

  it.each(['shapes', 'commands', 'attributes', 'decorators'] as const)('跨插件重复 %s 名称时拒绝后者，保留先前插件', (category) => {
    const duplicate: PluginRegistration = {
      name: 'duplicate',
      contributes: { [category]: all.contributes[category] },
      classes: { [category]: all.classes[category] },
    };
    const host = assemblePlugins([all, duplicate]);
    expect(host.plugins).toEqual(['all']);
    expect(host.errors[0]).toContain(`duplicate registration: ${category}/`);
    expect(host.client.execute([Hello.command]).lines()).toEqual(['hello from plugin']);
  });

  it('重复内置命令及插件名同样拒绝，未接纳命令不参与 help', () => {
    class Reserved extends Hello { static override readonly command = 'help'; }
    const host = assemblePlugins([
      all, all,
      { name: 'reserved', contributes: { commands: ['help'] }, classes: { commands: [Reserved] } },
    ]);
    expect(host.errors).toEqual(['duplicate registration: plugins/all', 'duplicate registration: commands/help']);
    expect(host.plugins).toEqual(['all']);
    expect(host.client.execute(['help']).lines().filter((line) => line === 'test-hello')).toHaveLength(1);
  });

  it('同一个插件可以提供已有命令协议支持的多个互斥形式', () => {
    class Empty extends Hello {
      static override readonly command = 'choice';
      static override accepts(args: readonly string[]): boolean { return args.length === 0; }
    }
    class WithArgument extends Empty {
      static override accepts(args: readonly string[]): boolean { return args.length === 1; }
      override execute(): CommandResult { return new CommandResult().line('argument form'); }
    }
    const host = assemblePlugins([{ name: 'forms', contributes: { commands: ['choice'] }, classes: { commands: [Empty, WithArgument] } }]);
    expect(host.errors).toEqual([]);
    expect(host.client.execute(['choice']).lines()).toEqual(['hello from plugin']);
    expect(host.client.execute(['choice', 'x']).lines()).toEqual(['argument form']);
  });

  it('装饰器构造失败不能污染已接纳的会话或 writer', () => {
    class Broken extends TreeDecorator {
      static override readonly decoratorName = 'broken';
      constructor(...args: ConstructorParameters<typeof PanelType>) { super(...args); throw new Error('constructor failed'); }
      protected override tag(): null { return null; }
    }
    const broken: PluginRegistration = {
      name: 'broken',
      contributes: { shapes: [Panel.type], decorators: [Broken.decoratorName] },
      classes: { shapes: [Panel], decorators: [Broken] },
    };
    const host = assemblePlugins([broken, all]);
    expect(host.plugins).toEqual(['all']);
    expect(host.errors[0]).toContain('constructor failed');
  });
});
