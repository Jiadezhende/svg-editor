import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDiscoveredHost } from '../../src/host/discovery';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'svg-discovery-')); });
afterEach(() => {
  if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('svg-discovery-')) throw new Error('unsafe cleanup target');
  rmSync(directory, { recursive: true, force: true });
});

const backendApi = JSON.stringify(pathToFileURL(resolve('src/backend/index.ts')).href);

function scannedPackageOf(folder: string, name: string, contributes: Record<string, string[]>, files: Record<string, string>) {
  const target = join(directory, folder);
  mkdirSync(target);
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name, type: 'module', contributes }));
  for (const [file, source] of Object.entries(files)) writeFileSync(join(target, file), source);
  return target;
}

function scannedCommandSource(name: string): string {
  return `import { Command, CommandResult } from ${backendApi};
    export default class Greeting extends Command {
      static command = ${JSON.stringify(name)};
      static usage = ${JSON.stringify(name)};
      execute() { return new CommandResult().line('discovered ${name}'); }
    }`;
}

function shapeSource(type: string): string {
  return `import { Shape } from ${backendApi};
    export default class Dot extends Shape { static type = ${JSON.stringify(type)}; }`;
}

function handlerSource(name: string, type: string): string {
  return `export default class Handler {
      static handlerName = ${JSON.stringify(name)};
      static matches(shape, key) { return shape.type() === ${JSON.stringify(type)} && key === 'fill'; }
      static apply(shape) { shape.set('fill', 'red'); }
      static display() { return 'red'; }
    }`;
}

function decoratorSource(name: string, type: string): string {
  return `import { TreeDecorator } from ${backendApi};
    export default class Tag extends TreeDecorator {
      static decoratorName = ${JSON.stringify(name)};
      tag(node) { return node?.value.type() === ${JSON.stringify(type)} ? '(dot)' : null; }
    }`;
}

// 用真实 Node/tsx 加载磁盘包，避免测试转换器替代原生模块解析（尤其 Windows 编码路径）。
function runHost(body: string): any {
  const discovery = JSON.stringify(pathToFileURL(resolve('src/host/discovery.ts')).href);
  const assembly = JSON.stringify(pathToFileURL(resolve('src/host/PluginHost.ts')).href);
  const scan = JSON.stringify(pathToFileURL(resolve('src/host/scan.ts')).href);
  const source = `import { createDiscoveredHost } from ${discovery};
    import { assemblePlugins } from ${assembly};
    import { scanPlugin } from ${scan};
    import { join } from 'node:path';
    const directory = process.argv[1]; ${body}`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source, directory], { encoding: 'utf8', cwd: resolve('.') });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

describe('全部插件目录发现', () => {
  it('发行包与代码装配输出一致，基础能力确实来自已发现包', () => {
    const result = runHost(`const { readFileSync } = await import('node:fs');
      const registrations = [];
      for (const name of ['commands', 'shapes']) {
        const folder = join(process.cwd(), 'plugins', name);
        const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
        registrations.push({ name: manifest.name, contributes: manifest.contributes, plugin: await scanPlugin(folder) });
      }
      const direct = await assemblePlugins(registrations);
      const discovered = await createDiscoveredHost(undefined, () => {});
      console.log(JSON.stringify([direct, discovered].map(host => {
        host.client.execute(['init']);
        host.client.execute(['create', 'g', 'g']);
        return { plugins: host.plugins, errors: host.errors, help: host.client.execute(['help']).lines(), tree: host.client.execute(['tree']).lines() };
      })));`);
    expect(result[0].plugins).toEqual(['commands', 'shapes']);
    expect(result[0].errors).toEqual([]);
    expect(result[1]).toEqual(result[0]);
  });

  it('目录缺失或没有插件时仅保留框架入口', async () => {
    const empty = await createDiscoveredHost(directory, () => {});
    const missing = await createDiscoveredHost(join(directory, 'missing'), () => {});
    expect(empty.errors).toEqual([]);
    expect(missing.errors).toEqual([]);
    expect(empty.client.execute(['help']).lines()).toEqual(['help', 'undo', 'redo', 'exit', 'quit']);
  });

  it('按目录名稳定发现所有包，不维护插件名称清单，新命令参与分发和 help', async () => {
    scannedPackageOf('z-last', 'plugin-last', { commands: ['discovered-z'] }, { 'Command.mjs': scannedCommandSource('discovered-z') });
    scannedPackageOf('a-first', 'plugin-first', { commands: ['discovered-a'] }, { 'Command.mjs': scannedCommandSource('discovered-a') });
    mkdirSync(join(directory, 'assets'));
    writeFileSync(join(directory, 'ignored.txt'), 'not a package');
    const host = runHost(`const host = await createDiscoveredHost(directory, () => {});
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins,
        a: host.client.execute(['discovered-a']).lines(), z: host.client.execute(['discovered-z']).lines(), help: host.client.execute(['help']).lines() }));`);
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['plugin-first', 'plugin-last']);
    expect(host.a).toEqual(['discovered discovered-a']);
    expect(host.z).toEqual(['discovered discovered-z']);
    const help = host.help as string[];
    expect(help.indexOf('discovered-a')).toBeLessThan(help.indexOf('discovered-z'));
  });

  it('清单含 main 时仍扫描根目录的默认导出', () => {
    const target = scannedPackageOf('one', 'one', { commands: ['discovered'] }, { 'Command.mjs': scannedCommandSource('discovered') });
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'one', type: 'module', main: 'missing.mjs', contributes: { commands: ['discovered'] } }));
    const host = runHost(`const host = await createDiscoveredHost(directory, () => {});
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, result: host.client.execute(['discovered']).lines() }));`);
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['one']);
    expect(host.result).toEqual(['discovered discovered']);
  });

  it('扫描包根目录，按文件名排序自动注册四类贡献', () => {
    scannedPackageOf('scan', 'scan', {
      shapes: ['scan-dot'], commands: ['scan-a', 'scan-z'], attributes: ['scan-handler'], decorators: ['scan-tag'],
    }, {
      'Dot.mjs': shapeSource('scan-dot'),
      'ACommand.mjs': scannedCommandSource('scan-a'),
      'ZCommand.mjs': scannedCommandSource('scan-z'),
      'Handler.mjs': handlerSource('scan-handler', 'scan-dot'),
      'Tag.mjs': decoratorSource('scan-tag', 'scan-dot'),
    });
    const host = runHost(`const { Document } = await import(${backendApi});
      const host = await createDiscoveredHost(directory, () => {});
      const help = host.client.execute(['help']).lines();
      const shape = host.workspace.shapes().create('scan-dot', 'd');
      const handler = host.workspace.attributeHandlerRegistry().resolve(shape, 'fill');
      if (handler) handler.apply(shape, 'fill', 'blue');
      const doc = new Document(100, 100);
      doc.insert(shape);
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins,
        a: host.client.execute(['scan-a']).lines(), z: host.client.execute(['scan-z']).lines(),
        tree: host.workspace.treeRenderer().render(doc), fill: handler ? handler.display(shape, 'fill') : null,
        hasShape: host.workspace.shapes().has('scan-dot'),
        aBeforeZ: help.indexOf('scan-a') < help.indexOf('scan-z') }));`);
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['scan']);
    expect(host.a).toEqual(['discovered scan-a']);
    expect(host.z).toEqual(['discovered scan-z']);
    expect(host.hasShape).toBe(true);
    expect(host.tree[1]).toContain('(dot)');
    expect(host.fill).toBe('red');
    expect(host.aBeforeZ).toBe(true);
  });

  it('扫描模式可用同模块 named export mapping 配对复合写出', () => {
    const source = `import { Shape } from ${backendApi};
      export default class Mapped extends Shape { static type = 'scan-mapped'; }
      export const mapping = {
        matches: (shape) => shape.type() === 'scan-mapped',
        write: (shape) => ({ type: 'rect', attributes: [['id', shape.id()], ['data-kind', 'scan-mapped']] }),
      };`;
    scannedPackageOf('mapped', 'mapped', { shapes: ['scan-mapped'] }, { 'Mapped.mjs': source });
    const host = runHost(`const { Document } = await import(${backendApi});
      const host = await createDiscoveredHost(directory, () => {});
      const shape = host.workspace.shapes().create('scan-mapped', 'm');
      const doc = new Document(100, 100);
      doc.insert(shape);
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, svg: host.workspace.svgWriter().write(doc) }));`);
    expect(host.errors).toEqual([]);
    expect(host.plugins).toEqual(['mapped']);
    expect(host.svg).toContain('<rect id="m" data-kind="scan-mapped"/>');
  });

  it('扫描模式的清单不一致或非法默认导出丢弃整个包，继续加载后续包', () => {
    scannedPackageOf('a-mismatch', 'mismatch', { shapes: ['declared-dot'] }, {
      'Dot.mjs': shapeSource('actual-dot'),
    });
    scannedPackageOf('b-invalid', 'invalid', {}, {
      'Helper.mjs': 'export default {};',
    });
    scannedPackageOf('z-good', 'good', { commands: ['healthy'] }, { 'Command.mjs': scannedCommandSource('healthy') });
    const host = runHost(`const host = await createDiscoveredHost(directory, () => {});
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins,
        result: host.client.execute(['healthy']).lines(), hasDot: host.workspace.shapes().has('actual-dot') }));`);
    expect(host.plugins).toEqual(['good']);
    expect(host.errors).toHaveLength(2);
    expect(host.errors[0]).toContain('plugin manifest mismatch: mismatch');
    expect(host.errors[1]).toContain('plugin failed to load: invalid');
    expect(host.errors[1]).toContain('plugin contribution must be a class: Helper.mjs');
    expect(host.result).toEqual(['discovered healthy']);
    expect(host.hasDot).toBe(false);
  });

  it('扫描文件缺少默认导出、依赖加载失败或模块执行异常均报告，继续加载后续包', () => {
    scannedPackageOf('a-no-default', 'no-default', {}, { 'Helper.mjs': 'export const value = 1;' });
    scannedPackageOf('b-dependency', 'dependency', {}, { 'Helper.mjs': 'import "./missing-dependency.mjs";' });
    scannedPackageOf('c-module', 'module', {}, { 'Helper.mjs': 'throw new Error("module failed");' });
    scannedPackageOf('z-good', 'good', { commands: ['healthy'] }, { 'Command.mjs': scannedCommandSource('healthy') });
    const host = runHost(`const messages = []; const host = await createDiscoveredHost(directory, message => messages.push(message));
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, messages, result: host.client.execute(['healthy']).lines() }));`);
    const messages = host.messages as string[];
    expect(host.plugins).toEqual(['good']);
    expect(host.errors).toHaveLength(3);
    expect(messages[0]).toContain('error: plugin failed to load: no-default (plugin contribution must be a class: Helper.mjs)');
    expect(messages[1]).toContain('error: plugin failed to load: dependency');
    expect(messages[2]).toContain('error: plugin failed to load: module (module failed)');
    expect(host.result).toEqual(['discovered healthy']);
  });

  it('非法清单或贡献不一致不阻止基础宿主启动', async () => {
    const invalidJson = scannedPackageOf('a-invalid-json', 'invalid-json', {}, {});
    writeFileSync(join(invalidJson, 'package.json'), '{ broken');
    const invalidSchema = scannedPackageOf('b-invalid-schema', 'invalid-schema', {}, {});
    writeFileSync(join(invalidSchema, 'package.json'), JSON.stringify({ name: 1, contributes: [] }));
    scannedPackageOf('c-mismatch', 'mismatch', {}, { 'Command.mjs': scannedCommandSource('unexpected') });
    const host = runHost(`const host = await createDiscoveredHost(directory, () => {});
      let unknown; try { host.client.execute(['unexpected']); } catch (error) { unknown = error.message; }
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, unknown, hasGroup: host.workspace.shapes().has('g') }));`);
    expect(host.plugins).toEqual([]);
    expect(host.errors).toHaveLength(3);
    expect(host.errors[2]).toContain('plugin manifest mismatch: mismatch');
    expect(host.unknown).toContain('unknown command');
    expect(host.hasGroup).toBe(false);
  });
});
