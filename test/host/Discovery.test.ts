import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDiscoveredHost } from '../../src/host/discovery';
import { createClient } from '../../src/host/defaults';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'svg-discovery-')); });
afterEach(() => {
  if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('svg-discovery-')) throw new Error('unsafe cleanup target');
  rmSync(directory, { recursive: true, force: true });
});

function packageOf(folder: string, name: string, source: string, commands: string[] = []) {
  const target = join(directory, folder);
  mkdirSync(target);
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name, type: 'module', main: 'index.mjs', contributes: { commands } }));
  writeFileSync(join(target, 'index.mjs'), source);
  return join(target, 'index.mjs');
}

function commandSource(name: string): string {
  const api = JSON.stringify(pathToFileURL(resolve('src/backend/index.ts')).href);
  return `import { Command, CommandResult } from ${api};
    class Greeting extends Command {
      static command = ${JSON.stringify(name)};
      static usage = ${JSON.stringify(name)};
      execute() { return new CommandResult().line('discovered ${name}'); }
    }
    export default { activate(context) { context.registerCommand(Greeting); } };`;
}

// 用真实 Node/tsx 加载磁盘包，避免测试转换器替代原生模块解析（尤其 Windows 编码路径）。
function runHost(body: string): any {
  const discovery = JSON.stringify(pathToFileURL(resolve('src/host/discovery.ts')).href);
  const assembly = JSON.stringify(pathToFileURL(resolve('src/host/PluginHost.ts')).href);
  const source = `import { createDiscoveredHost } from ${discovery};
    import { assemblePlugins } from ${assembly};
    import { pathToFileURL } from 'node:url';
    import { join } from 'node:path';
    const directory = process.argv[1]; ${body}`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source, directory], { encoding: 'utf8', cwd: resolve('.') });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}

describe('全部插件目录发现', () => {
  it('目录缺失或没有插件时保留基础宿主与 help 输出', async () => {
    const empty = await createDiscoveredHost(directory, () => {});
    const missing = await createDiscoveredHost(join(directory, 'missing'), () => {});
    expect(empty.errors).toEqual([]);
    expect(missing.errors).toEqual([]);
    expect(empty.client.execute(['help']).lines()).toEqual(createClient().execute(['help']).lines());
  });

  it('按目录名稳定发现所有包，不维护插件名称清单，新命令参与分发和 help', async () => {
    packageOf('z-last', 'plugin-last', commandSource('discovered-z'), ['discovered-z']);
    packageOf('a-first', 'plugin-first', commandSource('discovered-a'), ['discovered-a']);
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

  it('实际模块经过相同注册路径，代码与自动发现装配输出一致', async () => {
    packageOf('one', 'one', commandSource('discovered'), ['discovered']);
    const results = runHost(`const loaded = await import(pathToFileURL(join(directory, 'one', 'index.mjs')).href);
      const direct = await assemblePlugins([{ name: 'one', contributes: { commands: ['discovered'] }, plugin: loaded.default }]);
      const discovered = await createDiscoveredHost(directory, () => {});
      console.log(JSON.stringify([direct, discovered].map(host => ({ errors: host.errors, help: host.client.execute(['help']).lines(), result: host.client.execute(['discovered']).lines() }))));`);
    expect(results[0].errors).toEqual([]);
    expect(results[1].errors).toEqual([]);
    expect(results[0]).toEqual(results[1]);
  });

  it('入口缺失、无默认导出、依赖失败或激活异常均报告，继续加载后续包', async () => {
    packageOf('a-missing', 'missing', 'export default {};');
    writeFileSync(join(directory, 'a-missing', 'package.json'), JSON.stringify({ name: 'missing', main: 'absent.mjs', contributes: {} }));
    packageOf('b-no-default', 'no-default', 'export const value = 1;');
    packageOf('c-dependency', 'dependency', 'import "./missing-dependency.mjs"; export default { activate() {} };');
    packageOf('d-activate', 'activate', 'export default { activate() { throw new Error("activation failed"); } };');
    packageOf('z-good', 'good', commandSource('healthy'), ['healthy']);
    const host = runHost(`const messages = []; const host = await createDiscoveredHost(directory, message => messages.push(message));
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, messages, result: host.client.execute(['healthy']).lines() }));`);
    const messages = host.messages as string[];
    expect(host.plugins).toEqual(['good']);
    expect(host.errors).toHaveLength(4);
    expect(messages.some((message) => message.startsWith('error: plugin not found:'))).toBe(true);
    expect(messages.some((message) => message.startsWith('error: plugin has no default export:'))).toBe(true);
    expect(messages.some((message) => message.startsWith('error: plugin failed to load: dependency'))).toBe(true);
    expect(messages.some((message) => message.startsWith('error: plugin failed to activate: activate'))).toBe(true);
    expect(host.result).toEqual(['discovered healthy']);
  });

  it('非法清单或贡献不一致不阻止基础宿主启动', async () => {
    packageOf('a-invalid-json', 'invalid-json', 'export default {};');
    writeFileSync(join(directory, 'a-invalid-json', 'package.json'), '{ broken');
    packageOf('b-invalid-schema', 'invalid-schema', 'export default {};');
    writeFileSync(join(directory, 'b-invalid-schema', 'package.json'), JSON.stringify({ name: 1, contributes: [] }));
    packageOf('c-mismatch', 'mismatch', commandSource('unexpected'), []);
    const host = runHost(`const host = await createDiscoveredHost(directory, () => {});
      let unknown; try { host.client.execute(['unexpected']); } catch (error) { unknown = error.message; }
      host.client.execute(['init']); host.client.execute(['create', 'g', 'g']);
      console.log(JSON.stringify({ errors: host.errors, plugins: host.plugins, unknown, type: host.workspace.document().requireNode('g').value.type() }));`);
    expect(host.plugins).toEqual([]);
    expect(host.errors).toHaveLength(3);
    expect(host.errors[2]).toContain('plugin manifest mismatch: mismatch');
    expect(host.unknown).toContain('unknown command');
    expect(host.type).toBe('g');
  });
});
