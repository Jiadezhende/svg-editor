import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 以脚本回放方式运行真实入口（stdin 为管道，即非 TTY）。 */
function runCli(script: string): string[] {
  const proc = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: ROOT,
    input: script,
    encoding: 'utf8',
  });
  expect(proc.stderr).toBe('');
  expect(proc.status).toBe(0);
  return proc.stdout.replace(/\n$/, '').split('\n');
}

describe('main 入口（脚本回放）', () => {
  it('help 列出全部 21 个命令及语法', () => {
    const lines = runCli('help\n');
    expect(lines.slice(0, 2)).toEqual(["svg-editor 0.1 — type 'help' for commands", 'svg> help']);
    expect([...lines.slice(2)].sort()).toEqual(
      [
        'init [w] [h]',
        'read <file.svg>',
        'save [file.svg]',
        'canvas [<w> <h>]',
        'create <type> <id> [params…] [in <containerId>]',
        'delete <id>',
        'move <id> <dx> <dy>',
        'scale <id> <factor>',
        'set <id> <attr> <value>',
        'group <newGid> <id1> <id2>…',
        'ungroup <gid>',
        'addto <gid> <id>',
        'front <id>',
        'back <id>',
        'tree [id]',
        'show <id>',
        'help',
        'undo',
        'redo',
        'exit',
        'quit',
      ].sort(),
    );
  });

  it('占位命令与未知命令报错不同；exit 后进程正常结束', () => {
    expect(runCli('move r1 10 0\nfoo\nexit\nhelp\n')).toEqual([
      "svg-editor 0.1 — type 'help' for commands",
      'svg> move r1 10 0',
      'error: command not implemented yet: move',
      'svg> foo',
      'error: unknown command: foo',
      'svg> exit',
    ]);
  });

  it('文档生命周期与画布：无文档、init、覆盖警告、查看与修改尺寸', () => {
    const script = [
      'canvas',
      'canvas a 0',
      'init 400',
      'init a 600',
      'init 0 600',
      'init',
      'init 100.5 200',
      'canvas 1024 768',
      'canvas 0 600',
      'canvas',
    ];
    expect(runCli(script.join('\n') + '\n').slice(1)).toEqual([
      'svg> canvas',
      "error: no document. use 'init' or 'read' first",
      'svg> canvas a 0',
      'error: not a number: a',
      'svg> init 400',
      'error: wrong number of arguments. usage: init [w] [h]',
      'svg> init a 600',
      'error: not a number: a',
      'svg> init 0 600',
      'error: canvas size must be positive',
      'svg> init',
      'canvas 800x600 created',
      'svg> init 100.5 200',
      'warning: previous document discarded',
      'canvas 100.5x200 created',
      'svg> canvas 1024 768',
      'canvas resized to 1024x768',
      'svg> canvas 0 600',
      'error: canvas size must be positive',
      'svg> canvas',
      'canvas 1024x768',
    ]);
  });

  it('图形创建与删除：in 子句、各类报错、容器连同子孙删除', () => {
    const script = [
      'create rect r1 0 0 10 10',
      'init',
      'create rect r1 10 20 100 50 #eee',
      'create text t1 20 40 "My Diagram"',
      'create g node1',
      'create rect start 120 100 160 60 #4a90d9 in node1',
      'create text start-label 155 135 "开始" in node1',
      'create rect 1abc 0 0 1 1',
      'create rect r1 0 0 1 1',
      'create circle c1 0 0 -5',
      'create rect r2 0 0 1 1 in node9',
      'create rect r2 0 0 1 1 in start',
      'create rect r2 0 0 10 10 in',
      'create rect r2 a 0 1 1',
      'create hexagon h1',
      'create box n1 0 0 10 10 "t"',
      'delete node1',
      'delete start',
      'delete r9',
      'create g node1',
    ];
    expect(runCli(script.join('\n') + '\n').slice(1)).toEqual([
      'svg> create rect r1 0 0 10 10',
      "error: no document. use 'init' or 'read' first",
      'svg> init',
      'canvas 800x600 created',
      'svg> create rect r1 10 20 100 50 #eee',
      'rect#r1 created',
      'svg> create text t1 20 40 "My Diagram"',
      'text#t1 created',
      'svg> create g node1',
      'g#node1 created',
      'svg> create rect start 120 100 160 60 #4a90d9 in node1',
      'rect#start created in g#node1',
      'svg> create text start-label 155 135 "开始" in node1',
      'text#start-label created in g#node1',
      'svg> create rect 1abc 0 0 1 1',
      'error: invalid id: 1abc',
      'svg> create rect r1 0 0 1 1',
      'error: id already exists: r1',
      'svg> create circle c1 0 0 -5',
      'error: r must be non-negative',
      'svg> create rect r2 0 0 1 1 in node9',
      'error: no such container: node9',
      'svg> create rect r2 0 0 1 1 in start',
      'error: not a container: start',
      'svg> create rect r2 0 0 10 10 in',
      'error: wrong number of arguments. usage: create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]',
      'svg> create rect r2 a 0 1 1',
      'error: not a number: a',
      'svg> create hexagon h1',
      'error: unknown shape type: hexagon (is the plugin loaded?)',
      'svg> create box n1 0 0 10 10 "t"',
      'error: unknown shape type: box (is the plugin loaded?)',
      'svg> delete node1',
      'g#node1 deleted',
      'svg> delete start',
      'error: no such shape: start',
      'svg> delete r9',
      'error: no such shape: r9',
      'svg> create g node1',
      'g#node1 created',
    ]);
  });

  it('CRLF 换行的脚本与 LF 结果一致', () => {
    expect(runCli('# c\r\nquit\r\n')).toEqual(["svg-editor 0.1 — type 'help' for commands", 'svg> # c', 'svg> quit']);
  });
});
