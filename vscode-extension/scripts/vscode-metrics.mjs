import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (outIndex >= 0) args.splice(outIndex, 2);
const [base = 'final', target = 'HEAD'] = args;
const extensionRoot = 'vscode-extension/src';

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function filesInWorktree(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesInWorktree(path));
    else if (entry.isFile() && /\.(?:ts|mts)$/.test(entry.name)) result.push(path);
  }
  return result;
}

const routines = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod']);
const branches = new Set([
  'IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement', 'CatchClause', 'ConditionalExpression',
]);

function complexity(source) {
  let count = 1;
  const visit = (node) => {
    if (node === null || typeof node !== 'object' || typeof node.type !== 'string') return;
    if ((routines.has(node.type) && node.body) || branches.has(node.type) ||
      (node.type === 'SwitchCase' && node.test !== null) || node.type === 'LogicalExpression') count += 1;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(parse(source, { sourceType: 'unambiguous', plugins: ['typescript'] }).program);
  return count;
}

function scope(path) {
  if (!path.startsWith(`${extensionRoot}/`) || !/\.(?:ts|mts)$/.test(path) || /\.(?:d|test|spec)\./.test(path)) return null;
  if (path.endsWith('/extension.ts')) return '入口';
  if (path.includes('/decoration/')) return '文件标记';
  if (path.includes('/outline/')) return '大纲';
  return '路径判断';
}

function measure(revision) {
  if (revision === 'WORKTREE') {
    const rows = new Map();
    for (const path of filesInWorktree(join(root, extensionRoot))) {
      const relative = path.slice(root.length).replaceAll('\\', '/');
      const group = scope(relative);
      if (group === null) continue;
      const source = readFileSync(path, 'utf8');
      const lines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'));
      rows.set(relative, { group, lines, complexity: complexity(source) });
    }
    return { label: 'WORKTREE', rows };
  }
  const sha = git('rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`).trim();
  const rows = new Map();
  for (const path of git('ls-tree', '-rz', '--name-only', sha).split('\0')) {
    const group = scope(path);
    if (group === null) continue;
    const source = git('show', `${sha}:${path}`);
    const lines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'));
    rows.set(path, { group, lines, complexity: complexity(source) });
  }
  return { label: sha, rows };
}

function totals(rows, group) {
  return [...rows.values()].filter((row) => row.group === group).reduce((total, row) => [
    total[0] + 1, total[1] + row.lines, total[2] + row.complexity,
  ], [0, 0, 0]);
}

const before = measure(base);
const after = measure(target);
const groups = ['入口', '文件标记', '大纲', '路径判断'];
const lines = [];
const print = (line = '') => lines.push(line);
print('# VS Code 扩展源码指标');
print('');
print(`基线提交 \`${before.label}\`，目标 \`${after.label}\`。`);
print('');
print('统计 `vscode-extension/src` 的扩展运行源码，不含测试、构建产物和 CLI 源码。行数按物理行统计，圈复杂度口径与 CLI 报告一致。');
print('');
print('| 分类 | 文件基线 | 文件目标 | 行数基线 | 行数目标 | 行数增量 | 复杂度基线 | 复杂度目标 | 复杂度增量 |');
print('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const group of groups) {
  const [aFiles, aLines, aComplexity] = totals(before.rows, group);
  const [bFiles, bLines, bComplexity] = totals(after.rows, group);
  print(`| ${group} | ${aFiles} | ${bFiles} | ${aLines} | ${bLines} | ${bLines - aLines} | ${aComplexity} | ${bComplexity} | ${bComplexity - aComplexity} |`);
}
print('');
print('## 文件与职责');
print('');
print('| 路径 | 分类 | 行数基线 → 目标 | 复杂度基线 → 目标 |');
print('| --- | --- | ---: | ---: |');
for (const path of [...new Set([...before.rows.keys(), ...after.rows.keys()])].sort()) {
  const a = before.rows.get(path);
  const b = after.rows.get(path);
  print(`| \`${path}\` | ${(b ?? a).group} | ${a?.lines ?? '–'} → ${b?.lines ?? '–'} | ${a?.complexity ?? '–'} → ${b?.complexity ?? '–'} |`);
}

const text = `${lines.join('\n')}\n`;
if (outPath !== null && outPath !== undefined) writeFileSync(outPath, text, 'utf8');
else process.stdout.write(text);
