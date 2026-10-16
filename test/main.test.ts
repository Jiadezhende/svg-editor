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

  it('CRLF 换行的脚本与 LF 结果一致', () => {
    expect(runCli('# c\r\nquit\r\n')).toEqual(["svg-editor 0.1 — type 'help' for commands", 'svg> # c', 'svg> quit']);
  });
});
