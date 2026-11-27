import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const api = JSON.stringify(pathToFileURL(join(root, 'src/backend/index.ts')).href);
let directory: string;

beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'svg-config-')); });
afterEach(() => {
  if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('svg-config-')) {
    throw new Error('unsafe cleanup target');
  }
  rmSync(directory, { recursive: true, force: true });
});

function writePackage(folder: string, name: string, commands: string[], source: string) {
  const target = join(directory, folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'package.json'), JSON.stringify({
    name, type: 'module', main: './plugin.mjs', exports: { import: './plugin.mjs' }, contributes: { commands },
  }));
  writeFileSync(join(target, 'plugin.mjs'), source);
}

function commandSource(...names: string[]): string {
  return `import { Command, CommandResult } from ${api};
    export default function activate(options) {
      return { shapes: [], attributes: [], decorators: [], commands: ${JSON.stringify(names)}.map(name =>
        class extends Command {
          static command = name;
          static usage = name;
          execute() { return new CommandResult().line(options.message ?? name); }
        }) };
    }`;
}

function config(value: unknown): string {
  const path = join(directory, 'plugins.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function run(args: string[], input = 'help\nquit\n') {
  const result = spawnSync(process.execPath, [
    '--experimental-import-meta-resolve', '--import', 'tsx', 'src/main.ts', ...args,
  ], { cwd: root, encoding: 'utf8', input });
  if (result.error) throw result.error;
  return result;
}

describe('CLI 配置装配', () => {
  it('正式入口要求传入配置路径', () => {
    const result = run([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage: npm run cli -- --config <path>');
    expect(result.stdout).toBe('');
  });

  it('使用配置所在目录解析相对路径和包名，按顺序装配并传参，禁用的模块不求值', () => {
    writePackage('z', 'last-by-name', ['first'], commandSource('first'));
    writePackage('node_modules/@demo/command', '@demo/command', ['second'], commandSource('second'));
    writePackage('disabled', 'disabled', [], 'throw new Error("must never be imported");');
    const path = config({ plugins: [
      { module: './z', options: { message: 'options received' } },
      { module: './disabled', enabled: false },
      { module: '@demo/command' },
      { module: './missing', enabled: false },
    ] });
    const result = run(['--config', path], 'help\nfirst\nsecond\nquit\n');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('first\nsecond\nhelp\nundo\nredo\nexit\nquit');
    expect(result.stdout).toContain('svg> first\noptions received\nsvg> second\nsecond');
  });

  it('错误分类准确，清单和重复注册拒绝整个包，随后可注册相同名称', () => {
    writePackage('good', 'good', ['kept'], commandSource('kept'));
    writePackage('no-default', 'no-default', [], 'export const extra = 1;');
    writePackage('dependency', 'dependency', [], 'import "./missing.mjs";');
    writePackage('evaluation', 'evaluation', [], 'throw new Error("evaluation failed");');
    writePackage('mismatch', 'mismatch', ['declared'], commandSource('recovered'));
    writePackage('activation', 'activation', ['recovered'], 'export default () => { throw new Error("activation failed"); };');
    writePackage('duplicate', 'duplicate', ['recovered', 'kept'], commandSource('recovered', 'kept'));
    writePackage('recovery', 'recovery', ['recovered'], commandSource('recovered'));
    const path = config({ plugins: [
      'good', 'missing', 'no-default', 'dependency', 'evaluation', 'mismatch', 'activation', 'duplicate', 'recovery',
    ].map((name) => ({ module: `./${name}` })).concat({ module: '@missing/package' }) });
    const result = run(['--config', path], 'kept\nrecovered\ndeclared\nquit\n');
    expect(result.status).toBe(0);
    const errors = result.stderr.trim().split(/\r?\n/);
    expect(errors).toEqual([
      'error: plugin not found: ./missing',
      'error: plugin has no default export: ./no-default',
      expect.stringMatching(/^error: plugin failed to load: dependency .*missing\.mjs/),
      'error: plugin failed to load: evaluation (evaluation failed)',
      'error: plugin manifest mismatch: mismatch (declared: commands/declared; registered: commands/recovered)',
      'error: plugin failed to activate: activation (activation failed)',
      'error: duplicate registration: commands/kept',
      'error: plugin not found: @missing/package',
    ]);
    expect(result.stdout).toContain('svg> kept\nkept\nsvg> recovered\nrecovered\nsvg> declared\nerror: unknown command: declared');
  });

  it('支持显式入口文件，宿主在导入前校验所属包的清单', () => {
    writePackage('file', 'file', ['file-command'], commandSource('file-command'));
    writePackage('broken', 'broken', ['same', 'same'], 'throw new Error("must never be imported");');
    const path = config({ plugins: [{ module: './broken' }, { module: './file/plugin.mjs' }] });
    const result = run(['--config', path], 'file-command\nquit\n');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('error: plugin failed to load: ./broken (invalid contribution declaration: commands)\n');
    expect(result.stdout).toContain('svg> file-command\nfile-command');
  });

  it('空配置只保留框架命令', () => {
    const result = run(['--config', config({ plugins: [] })]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('svg> help\nhelp\nundo\nredo\nexit\nquit\nsvg> quit');
  });

  it.each(['missing file', 'invalid JSON', 'invalid option type', 'invalid enabled type'])(
    '%s 回退至 Phase 1', (kind) => {
      const path = join(directory, 'plugins.json');
      if (kind === 'invalid JSON') writeFileSync(path, '{');
      if (kind === 'invalid option type') config({ plugins: [{ module: './arbitrary', options: [] }] });
      if (kind === 'invalid enabled type') config({ plugins: [{ module: './arbitrary', enabled: 'false' }] });
      const result = run(['--config', path], 'init\ncreate rect r 0 0 1 1\nquit\n');
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('error: invalid plugin config\n');
      expect(result.stdout).toContain('rect#r created');
    },
  );
});
