import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import DocumentCommand from '../../../../src/backend/command/DocumentCommand';
import ReadCommand from '../../../../src/backend/command/impl/ReadCommand';
import SaveCommand from '../../../../src/backend/command/impl/SaveCommand';
import TreeCommand from '../../../../src/backend/command/impl/TreeCommand';
import EditorError from '../../../../src/backend/error/EditorError';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'svg-cmd-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 文档含 bg、title、markers{c1, box}。 */
function sample(): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  for (const args of [
    ['rect', 'bg', '0', '0', '800', '600', '#ffffff'],
    ['text', 'title', '20', '40', 'My Diagram'],
    ['g', 'markers'],
    ['circle', 'c1', '100', '100', '20', 'red', 'in', 'markers'],
    ['rect', 'box', '200', '80', '60', '60', '#3366ff', 'in', 'markers'],
  ]) {
    new CreateCommand(workspace, args).execute();
  }
  return workspace;
}

function tree(workspace: Workspace): string[] {
  return [...new TreeCommand(workspace, []).execute().lines()];
}

describe('SaveCommand', () => {
  it('是文档类命令；保存并回显元素数（含 g，不含 svg 根）', () => {
    const path = join(dir, 'demo.svg');
    const command = new SaveCommand(sample(), [path]);
    expect(command).toBeInstanceOf(DocumentCommand);
    expect(command.execute().lines()).toEqual([`saved to ${path} (5 elements)`]);
    expect(readFileSync(path, 'utf8')).toContain('<circle id="c1" cx="100" cy="100" r="20" fill="red"/>');
  });

  it('save <path> 后该路径成为当前路径，无参 save 保存到这里', () => {
    const workspace = sample();
    const path = join(dir, 'a.svg');
    new SaveCommand(workspace, [path]).execute();
    new CreateCommand(workspace, ['g', 'later']).execute();
    expect(new SaveCommand(workspace, []).execute().lines()).toEqual([`saved to ${path} (6 elements)`]);
    expect(readFileSync(path, 'utf8')).toContain('<g id="later"/>');
  });

  it('文档来自 init（无路径）时无参 save 报错，提示指定文件名', () => {
    expect(() => new SaveCommand(sample(), []).execute()).toThrow(new EditorError("no file path. use 'save <file.svg>'"));
  });

  it('文件不可写时报错，当前路径不变', () => {
    const workspace = sample();
    const good = join(dir, 'a.svg');
    new SaveCommand(workspace, [good]).execute();
    const bad = join(dir, 'missing', 'b.svg');
    expect(() => new SaveCommand(workspace, [bad]).execute()).toThrow(new EditorError(`cannot write file: ${bad}`));
    expect(workspace.path()).toBe(good);
  });

  it('无文档时报无文档；参数个数在构造时校验', () => {
    expect(() => new SaveCommand(new Workspace(), ['a.svg']).execute()).toThrow("no document. use 'init' or 'read' first");
    expect(() => new SaveCommand(new Workspace(), ['a', 'b'])).toThrow('wrong number of arguments. usage: save [file.svg]');
  });
});

describe('ReadCommand', () => {
  it('是文档类命令；save 后 read 读回，tree 与保存前一致，回显元素数', () => {
    const original = sample();
    const path = join(dir, 'demo.svg');
    new SaveCommand(original, [path]).execute();
    const workspace = new Workspace();
    const command = new ReadCommand(workspace, [path]);
    expect(command).toBeInstanceOf(DocumentCommand);
    const result = command.execute();
    expect(result.warnings()).toEqual([]);
    expect(result.lines()).toEqual([`read ${path} (5 elements)`]);
    expect(tree(workspace)).toEqual(tree(original));
  });

  it('read 后无参 save 保存到读入时的路径', () => {
    const path = join(dir, 'demo.svg');
    new SaveCommand(sample(), [path]).execute();
    const workspace = new Workspace();
    new ReadCommand(workspace, [path]).execute();
    expect(new SaveCommand(workspace, []).execute().lines()).toEqual([`saved to ${path} (5 elements)`]);
  });

  it('补 id 等读入警告先于结果行；覆盖已有文档时追加丢弃警告', () => {
    const path = join(dir, 'other.svg');
    writeFileSync(path, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect x="0" y="0" width="1" height="1"/></svg>');
    const workspace = sample();
    const result = new ReadCommand(workspace, [path]).execute();
    expect(result.warnings()).toEqual(['assigned id rect1 to unnamed <rect>', 'previous document discarded']);
    expect(result.lines()).toEqual([`read ${path} (1 elements)`]);
    expect([workspace.document().width(), workspace.document().height()]).toEqual([400, 300]);
  });

  it('文件不存在时报 cannot read file，当前文档不变', () => {
    const workspace = sample();
    const before = workspace.document();
    const path = join(dir, 'a.svg');
    expect(() => new ReadCommand(workspace, [path]).execute()).toThrow(new EditorError(`cannot read file: ${path}`));
    expect(workspace.document()).toBe(before);
  });

  it('文件内容非法时报错，当前文档与路径不变', () => {
    const workspace = sample();
    const good = join(dir, 'good.svg');
    new SaveCommand(workspace, [good]).execute();
    const before = workspace.document();
    const bad = join(dir, 'bad.svg');
    writeFileSync(bad, '<svg><rect id="a" x="1" y="1" width="1" height="1"/><rect id="a" x="1" y="1" width="1" height="1"/></svg>');
    expect(() => new ReadCommand(workspace, [bad]).execute()).toThrow('id already exists: a');
    expect(workspace.document()).toBe(before);
    expect(workspace.path()).toBe(good);
  });

  it('参数个数在构造时校验', () => {
    expect(() => new ReadCommand(new Workspace(), [])).toThrow('wrong number of arguments. usage: read <file.svg>');
  });
});
