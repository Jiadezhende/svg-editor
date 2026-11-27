import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('..', import.meta.url));
const [base = 'final', target = 'HEAD'] = process.argv.slice(2);
const groups = ['内核', '装配', '插件'];
const assemblyFiles = new Set(['src/main.ts', 'src/bootstrap.ts', 'src/pluginConfig.ts', 'src/cli-code.ts', 'src/runCli.ts']);

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function scope(path) {
  if (!/\.(?:ts|mts|js|mjs)$/.test(path) || /\.(?:d|test|spec)\./.test(path)) return null;
  if (path.startsWith('plugins/')) return '插件';
  if (assemblyFiles.has(path) || path.startsWith('src/host/')) return '装配';
  return path.startsWith('src/') ? '内核' : null;
}

function responsibility(path) {
  const [, top, sub] = path.split('/');
  if (path.startsWith('plugins/')) {
    if (top !== 'core') return { box: '复合图形、属性、SVG 映射与树标签', dir: '目录命令与文件系统适配', stats: '图形统计命令',
      'modified-star': '保存基准与树标签' }[top] ?? '插件贡献';
    return path.endsWith('index.ts') ? '基础插件入口' : path.endsWith('Command.ts') ? 'Phase 1 用例命令' : '基础图形模型';
  }
  if (top === 'backend') {
    const areas = { command: '命令契约与用例', invoker: '执行与历史', error: '领域错误', utils: '数值格式', receiver: '接收者与领域服务' };
    return areas[sub] ?? '公开契约与命令分派';
  }
  if (top === 'frontend') return sub === 'io' ? '控制台输入输出适配' : '读行、分词与输出';
  if (path.endsWith('App.ts')) return 'CLI 会话循环';
  return top === 'pluginConfig.ts' ? '配置与模块加载' : 'CLI 启动与宿主装配';
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

function measure(revision) {
  const sha = git('rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`).trim();
  const rows = new Map();
  for (const path of git('ls-tree', '-r', '--full-tree', '-rz', '--name-only', sha).split('\0')) {
    // 迁移到 cli/ 前后的提交都按 CLI 根目录内的相对路径归并。
    const relative = path.startsWith('cli/') ? path.slice(4) : path;
    const group = scope(relative);
    if (group === null) continue;
    const source = git('show', `${sha}:${path}`);
    const lines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'));
    rows.set(relative, { group, lines, complexity: complexity(source) });
  }
  return { sha, rows };
}

function totals(rows, group) {
  return [...rows.values()].filter((row) => row.group === group).reduce((total, row) => [
    total[0] + 1, total[1] + row.lines, total[2] + row.complexity,
  ], [0, 0, 0]);
}

const before = measure(base);
const after = measure(target);
console.log('# CLI 源码指标\n');
console.log(`基线提交 \`${before.sha}\`，目标提交 \`${after.sha}\`。\n`);
console.log('统计 Git 提交中的 CLI 运行源码。内核含前端与 App，装配含入口和宿主，插件按源码路径归类。依赖、测试、文档、生成文件与 VS Code 扩展排除。\n');
console.log('行数按物理行统计。圈复杂度按每个文件顶层和每个有函数体的可调用单元各计 1，再计入条件、循环、catch、非 default 的 case、三元表达式和短路逻辑表达式。历史上位于内核的内置实现按历史位置计入内核。目录迁移到 `cli/` 前后的提交都按 CLI 根目录内的路径归并。\n');
console.log('| 分类 | 文件基线 | 文件目标 | 行数基线 | 行数目标 | 行数增量 | 复杂度基线 | 复杂度目标 | 复杂度增量 |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const group of groups) {
  const [aFiles, aLines, aComplexity] = totals(before.rows, group);
  const [bFiles, bLines, bComplexity] = totals(after.rows, group);
  console.log(`| ${group} | ${aFiles} | ${bFiles} | ${aLines} | ${bLines} | ${bLines - aLines} | ${aComplexity} | ${bComplexity} | ${bComplexity - aComplexity} |`);
}
console.log('\n## 文件与职责\n');
console.log('| 路径 | 分类 | 职责 | 行数基线 → 目标 | 复杂度基线 → 目标 |');
console.log('| --- | --- | --- | ---: | ---: |');
for (const path of [...new Set([...before.rows.keys(), ...after.rows.keys()])].sort()) {
  const a = before.rows.get(path);
  const b = after.rows.get(path);
  console.log(`| \`${path}\` | ${(b ?? a).group} | ${responsibility(path)} | ${a?.lines ?? '–'} → ${b?.lines ?? '–'} | ${a?.complexity ?? '–'} → ${b?.complexity ?? '–'} |`);
}
