import { describe, expect, it } from 'vitest';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import Document from '../../../../src/backend/receiver/document/Document';
import EditorError from '../../../../src/backend/error/EditorError';

describe('Workspace 当前文档槽位', () => {
  it('无文档时取文档报"无文档"', () => {
    expect(() => new Workspace().document()).toThrow(new EditorError("no document. use 'init' or 'read' first"));
  });

  it('首次放入文档时返回 false，之后可取回', () => {
    const workspace = new Workspace();
    const doc = new Document(800, 600);
    expect(workspace.replace(doc)).toBe(false);
    expect(workspace.document()).toBe(doc);
  });

  it('覆盖已有文档时返回 true，当前文档为新文档', () => {
    const workspace = new Workspace();
    workspace.replace(new Document(800, 600));
    const next = new Document(400, 200);
    expect(workspace.replace(next)).toBe(true);
    expect(workspace.document()).toBe(next);
  });
});
