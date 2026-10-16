import { describe, expect, it } from 'vitest';
import CanvasCommand from '../../../../src/backend/command/impl/CanvasCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';

function workspaceWith(width: number, height: number): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(width, height));
  return workspace;
}

function canvas(workspace: Workspace, ...args: string[]): string[] {
  return [...new CanvasCommand(workspace, args).execute().lines()];
}

describe('CanvasCommand', () => {
  it('无参时显示当前尺寸', () => {
    expect(canvas(workspaceWith(800, 600))).toEqual(['canvas 800x600']);
  });

  it('带参时修改尺寸并输出修改后的尺寸，之后显示新尺寸', () => {
    const workspace = workspaceWith(800, 600);
    expect(canvas(workspace, '1024', '768.50')).toEqual(['canvas resized to 1024x768.5']);
    expect(canvas(workspace)).toEqual(['canvas 1024x768.5']);
  });

  it('修改尺寸不改动 viewBox', () => {
    const workspace = workspaceWith(200, 100);
    canvas(workspace, '400', '300');
    expect(workspace.document().viewBox()).toEqual([0, 0, 200, 100]);
  });

  it.each([
    ['0', '600'],
    ['-1', '600'],
  ])('尺寸 %s x %s 非正数时报错，尺寸不变', (w, h) => {
    const workspace = workspaceWith(800, 600);
    expect(() => canvas(workspace, w, h)).toThrow('canvas size must be positive');
    expect(canvas(workspace)).toEqual(['canvas 800x600']);
  });

  it('参数个数或格式错误在构造阶段报出', () => {
    expect(() => new CanvasCommand(new Workspace(), ['400'])).toThrow('wrong number of arguments. usage: canvas [<w> <h>]');
    expect(() => new CanvasCommand(new Workspace(), ['a', '0'])).toThrow('not a number: a');
  });

  it.each([[[]], [['1024', '768']]])('无文档时执行报"无文档"：%j', (args) => {
    expect(() => new CanvasCommand(new Workspace(), args).execute()).toThrow("no document. use 'init' or 'read' first");
  });
});
