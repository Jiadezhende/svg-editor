import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import Document from '../../../../src/backend/receiver/document/Document';
import EditorError from '../../../../src/backend/error/EditorError';
import Rect from '../../../../plugins/shapes/Rect';

describe('Workspace 当前文档槽位', () => {
  it('无文档时取文档报"无文档"', async () => {
    await expect(async () => (await createWorkspace()).document()).rejects.toThrow(new EditorError("no document. use 'init' or 'read' first"));
  });

  it('首次放入文档时返回 false，之后可取回', async () => {
    const workspace = (await createWorkspace());
    const doc = new Document(800, 600);
    expect(workspace.replace(doc)).toBe(false);
    expect(workspace.document()).toBe(doc);
  });

  it('覆盖已有文档时返回 true，当前文档为新文档', async () => {
    const workspace = (await createWorkspace());
    workspace.replace(new Document(800, 600));
    const next = new Document(400, 200);
    expect(workspace.replace(next)).toBe(true);
    expect(workspace.document()).toBe(next);
  });

  it('持有图形工厂：无文档时也可取用，每个 Workspace 一份', async () => {
    const workspace = (await createWorkspace());
    expect(workspace.shapes().definition('rect').params).toEqual(Rect.params);
    expect(workspace.shapes()).toBe(workspace.shapes());
    expect((await createWorkspace()).shapes()).not.toBe(workspace.shapes());
  });

  it('持有文件读写', async () => {
    const workspace = (await createWorkspace());
    expect(workspace.files()).toBe(workspace.files());
  });

  it('文件路径：init 新建（不带路径）时没有路径，取路径报错', async () => {
    const workspace = (await createWorkspace());
    workspace.replace(new Document(800, 600));
    expect(() => workspace.path()).toThrow(new EditorError("no file path. use 'save <file.svg>'"));
  });

  it('文件路径：替换时带路径即记下；setPath 另存为；再次替换时随之更新', async () => {
    const workspace = (await createWorkspace());
    workspace.replace(new Document(800, 600), 'a.svg');
    expect(workspace.path()).toBe('a.svg');
    workspace.setPath('b.svg');
    expect(workspace.path()).toBe('b.svg');
    workspace.replace(new Document(800, 600));
    expect(() => workspace.path()).toThrow('no file path');
  });
});
