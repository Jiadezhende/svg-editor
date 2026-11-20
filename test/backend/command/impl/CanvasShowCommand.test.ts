import { createWorkspace } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CanvasShowCommand from '../../../../plugins/commands/CanvasShowCommand';
import Document from '../../../../src/backend/receiver/document/Document';

describe('CanvasShowCommand', () => {
  it('只接受无参', () => {
    expect(CanvasShowCommand.accepts([])).toBe(true);
    expect(CanvasShowCommand.accepts(['1'])).toBe(false);
    expect(CanvasShowCommand.accepts(['1024', '768'])).toBe(false);
  });

  it('显示当前尺寸，按数值格式输出', async () => {
    const workspace = (await createWorkspace());
    workspace.replace(new Document(800, 600.5));
    expect(new CanvasShowCommand(workspace, []).execute().lines()).toEqual(['canvas 800x600.5']);
  });

  it('无文档时报"无文档"', async () => {
    await expect(async () => new CanvasShowCommand((await createWorkspace()), []).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
  });
});
