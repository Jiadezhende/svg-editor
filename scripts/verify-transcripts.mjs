import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = join(root, 'doc/transcript');
const cache = join(root, 'coverage');
const tsx = import.meta.resolve('tsx');
const record = process.argv[2] === '--record';
assert(process.argv.length === (record ? 3 : 2), 'usage: node scripts/verify-transcripts.mjs [--record]');

function run(args, cwd, input, outputFile) {
  const output = spawnSync(process.execPath, ['--experimental-import-meta-resolve', '--import', tsx, ...args], { cwd, input });
  if (output.error) throw output.error;
  assert.equal(output.status, 0, output.stderr.toString('utf8'));
  assert.equal(output.stderr.length, 0, output.stderr.toString('utf8'));
  if (outputFile === null) return { stdout: output.stdout, svg: null };
  const path = join(cwd, outputFile);
  const svg = readFileSync(path);
  rmSync(path);
  return { stdout: output.stdout, svg };
}

function temporary(parent) {
  const path = mkdtempSync(join(parent, 'svg-transcripts-'));
  assert.equal(dirname(path), resolve(parent));
  assert(basename(path).startsWith('svg-transcripts-'));
  return path;
}

function verify(legacy, cwd, name, code, config, outputFile) {
  const input = readFileSync(join(fixtures, `${name}.txt`));
  const configured = run([join(root, 'src/main.ts'), '--config', config], cwd, input, outputFile);
  const explicit = run(code, cwd, input, outputFile);
  assert.deepEqual(configured, explicit, `${name} differs between code and configuration`);
  if (legacy !== null) {
    assert.deepEqual(configured, run([legacy], cwd, input, outputFile), `${name} differs from final`);
  }
  const expectedPath = join(fixtures, `${name}.out`);
  if (record) writeFileSync(expectedPath, configured.stdout);
  else assert.deepEqual(configured.stdout, readFileSync(expectedPath), `${name} differs from expected output`);
  console.log(`OK ${name}${legacy === null ? '' : ' (including final)'}`);
}

mkdirSync(cache, { recursive: true });
const baseline = temporary(cache);
const cwd = temporary(tmpdir());
try {
  const archive = join(baseline, 'final.tar');
  execFileSync('git', ['archive', '-o', archive, 'final', 'src', 'package.json'], { cwd: root });
  execFileSync('tar', ['-xf', archive, '-C', baseline]);
  const fixture = join(fixtures, 'other.svg');
  copyFileSync(fixture, join(cwd, 'other.svg'));
  mkdirSync(join(cwd, 'docs'));
  copyFileSync(fixture, join(cwd, 'docs', 'diagram.svg'));
  mkdirSync(join(cwd, 'plugins'));
  writeFileSync(join(cwd, '.hidden'), '');

  const url = (path) => JSON.stringify(pathToFileURL(join(root, path)).href);
  const coreCode = [
    `import activate from ${url('plugins/core/index.ts')};`,
    `import manifest from ${url('plugins/core/package.json')} with { type: 'json' };`,
    `import { createAssembler, readPluginManifest } from ${url('src/bootstrap.ts')};`,
    `import { runCli } from ${url('src/runCli.ts')};`,
    "const assembler = createAssembler(message => process.stderr.write(message + '\\n'));",
    'assembler.registerPlugin(readPluginManifest(manifest), activate);',
    'await runCli(assembler.getAssemblyResult().client);',
  ].join('\n');

  verify(join(baseline, 'src/main.ts'), cwd, 'phase1', ['--input-type=module', '--eval', coreCode],
    join(fixtures, 'phase1.plugins.json'), 'demo.svg');
  const fullCode = [join(root, 'src/cli-code.ts')];
  const fullConfig = join(root, 'plugins.config.json');
  verify(null, cwd, 'box', fullCode, fullConfig, 'flowchart-box.svg');
  verify(null, cwd, 'commands', fullCode, fullConfig, null);
} finally {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(baseline, { recursive: true, force: true });
}
