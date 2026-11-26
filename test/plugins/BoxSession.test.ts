import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import activateBox from '../../plugins/box/index';
import Box from '../../plugins/box/Box';
import activateStar from '../../plugins/modified-star/index';
import { createHost } from '../support/Plugins';

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) {
    if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith('svg-box-')) throw new Error('unsafe cleanup target');
    rmSync(path, { recursive: true, force: true });
  }
});

async function session() {
  const { client, receiver } = await createHost([
    { name: 'modified-star', contributes: { decorators: ['modified-star'] }, classes: activateStar() },
    { name: 'box', contributes: { shapes: ['box'], attributes: ['box-attributes'], decorators: ['box-type-label'] }, classes: activateBox() },
  ]);
  const execute = (...tokens: string[]) => client.execute(tokens).lines();
  execute('init');
  execute('create', 'box', 'n', '120', '100', '160', '60', '开始');
  return { execute, receiver };
}

describe('box 命令协作', () => {
  it('fill 和 label 各自撤销重做，私有部件跟踪变化，标签可并存', async () => {
    const { execute, receiver } = await session();
    const fill = () => (receiver.document().requireNode('n').value as Box).frameShape().display('fill');
    expect(execute('tree', 'n')[0]).toBe('g#n * (box)');
    execute('set', 'n', 'fill', '#f5a623');
    expect(fill()).toBe('#f5a623');
    execute('undo');
    expect(fill()).toBe('#4a90d9');
    execute('redo');
    execute('set', 'n', 'label', '处理数据 v2');
    expect(execute('tree', 'n')[2]).toContain('"处理数据 v2"');
    execute('undo');
    const restored = execute('tree', 'n');
    expect(fill()).toBe('#f5a623');
    expect(restored[2]).toContain('"开始"');
    execute('redo');
    expect(execute('tree', 'n')[2]).toContain('"处理数据 v2"');

    const dir = mkdtempSync(join(tmpdir(), 'svg-box-'));
    temporary.push(dir);
    execute('save', join(dir, 'box.svg'));
    const clean = execute('tree');
    execute('set', 'n', 'label', 'changed');
    expect(execute('tree', 'n')).toEqual([
      'g#n (box)',
      '├── rect#n-rect  x=120 y=100 width=160 height=60',
      '└── text#n-label  x=140 y=135 text="changed" *',
    ]);
    execute('undo');
    expect(execute('tree')).toEqual(clean);
  });

  it('编辑限制和损坏读入保持文档及重做记录', async () => {
    const { execute, receiver } = await session();
    execute('create', 'g', 'group');
    execute('addto', 'group', 'n');
    execute('set', 'n', 'label', 'new label');
    execute('undo');
    const document = receiver.document();
    const before = execute('tree');
    expect(() => execute('delete', 'n-rect')).toThrow('no such shape: n-rect');
    expect(() => execute('addto', 'group', 'n-label')).toThrow('no such shape: n-label');
    expect(() => execute('ungroup', 'n')).toThrow('cannot ungroup composite shape: n');
    expect(() => execute('create', 'rect', 'n-rect', '0', '0', '1', '1')).toThrow('id already exists: n-rect');
    const dir = mkdtempSync(join(tmpdir(), 'svg-box-'));
    temporary.push(dir);
    const invalid = join(dir, 'invalid.svg');
    writeFileSync(invalid, '<svg><g id="n" data-kind="box"><rect id="n-rect"/></g></svg>');
    expect(() => execute('read', invalid)).toThrow('invalid box parts: n');
    expect(receiver.document()).toBe(document);
    expect(execute('tree')).toEqual(before);
    execute('redo');
    expect(execute('tree', 'n')[2]).toContain('"new label"');
    execute('delete', 'n');
    expect(document.findNode('n')).toBeNull();
    execute('undo');
    expect(execute('tree', 'n')[2]).toContain('"new label"');
  });
});
