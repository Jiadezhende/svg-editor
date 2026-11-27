import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirCommand } from '../../plugins/dir/index';
import { NodeDirectoryAccess } from '../../plugins/dir/DirectoryAccess';
import type { DirectoryAccess } from '../../plugins/dir/DirectoryAccess';
import type { Receiver } from '../../src/backend';
import { createHost } from '../support/Plugins';

const unusedReceiver = {} as Receiver;
const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) {
    if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith('svg-dir-')) throw new Error('unsafe cleanup target');
    rmSync(path, { recursive: true, force: true });
  }
});

describe('dir 插件', () => {
  it('对替身返回的乱序项稳定排序，并保留隐藏项', () => {
    const entries = Object.freeze([
      { name: 'z-file', directory: false },
      { name: 'b-folder', directory: true },
      { name: '..', directory: true },
      { name: '.hidden', directory: false },
      { name: '.', directory: true },
      { name: 'a-folder', directory: true },
    ]);
    const access = { currentDirectory: () => '/test', read: vi.fn((_path: string) => entries) } satisfies DirectoryAccess;
    const command = new DirCommand(unusedReceiver, [], access);
    const expected = ['[DIR]  a-folder', '[DIR]  b-folder', '[FILE]  .hidden', '[FILE]  z-file'];
    expect(command.execute().lines()).toEqual(expected);
    expect(command.execute().lines()).toEqual(expected);
    expect(access.read).toHaveBeenCalledWith('/test');
    expect(() => new DirCommand(unusedReceiver, ['extra'], access)).toThrow('usage: dir');
  });

  it('使用真实适配器读取空目录和直接成员', () => {
    const path = mkdtempSync(join(tmpdir(), 'svg-dir-'));
    temporary.push(path);
    const command = new DirCommand(unusedReceiver, [], new NodeDirectoryAccess(path));
    expect(command.execute().lines()).toEqual(['(empty directory)']);
    mkdirSync(join(path, 'nested'));
    writeFileSync(join(path, 'nested', 'ignored.svg'), '');
    writeFileSync(join(path, 'hello.svg'), '');
    writeFileSync(join(path, '.hidden'), '');
    expect(command.execute().lines()).toEqual(['[DIR]  nested', '[FILE]  .hidden', '[FILE]  hello.svg']);
  });

  it('初始化前可用，已有文档时成功或失败都保留撤销和重做', async () => {
    let failed = false;
    const access: DirectoryAccess = {
      currentDirectory: () => '/test',
      read: () => {
        if (failed) throw new Error('access denied');
        return [];
      },
    };
    class InjectedDir extends DirCommand {
      constructor(receiver: Receiver, args: readonly string[]) { super(receiver, args, access); }
    }
    const { client, receiver } = await createHost([
      { name: 'test-dir', contributes: { commands: ['dir'] }, classes: { commands: [InjectedDir] } },
    ]);
    expect(client.execute(['dir']).lines()).toEqual(['(empty directory)']);
    client.execute(['init']);
    client.execute(['create', 'g', 'one']);
    client.execute(['create', 'g', 'two']);
    client.execute(['undo']);
    const before = receiver.document().shapeViews();
    expect(client.execute(['dir']).lines()).toEqual(['(empty directory)']);
    failed = true;
    expect(() => client.execute(['dir'])).toThrow('cannot read directory: /test');
    expect(receiver.document().shapeViews()).toEqual(before);
    expect(client.execute(['redo']).lines()).toEqual(['g#two created']);
    client.execute(['undo']);
    client.execute(['undo']);
    expect(receiver.document().children()).toEqual([]);
  });
});
