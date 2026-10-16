import { describe, expect, it } from 'vitest';
import InitCommand from '../../../../src/backend/command/impl/InitCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';

function init(workspace: Workspace, ...args: string[]) {
  return new InitCommand(workspace, args).execute();
}

describe('InitCommand', () => {
  it('无参时新建 800x600 文档，不产生警告', () => {
    const workspace = new Workspace();
    const result = init(workspace);
    expect(result.warnings()).toEqual([]);
    expect(result.lines()).toEqual(['canvas 800x600 created']);
    expect([workspace.document().width(), workspace.document().height()]).toEqual([800, 600]);
  });

  it('按给定尺寸新建，浮点尺寸按数值格式输出', () => {
    const workspace = new Workspace();
    expect(init(workspace, '400', '200').lines()).toEqual(['canvas 400x200 created']);
    expect(init(new Workspace(), '100.50', '200').lines()).toEqual(['canvas 100.5x200 created']);
  });

  it('已有文档时先警告，再替换为新文档', () => {
    const workspace = new Workspace();
    const old = new Document(800, 600);
    workspace.replace(old);
    const result = init(workspace, '400', '200');
    expect(result.warnings()).toHaveLength(1);
    expect(result.lines()).toEqual(['canvas 400x200 created']);
    expect(workspace.document()).not.toBe(old);
    expect(workspace.document().width()).toBe(400);
  });

  it.each([['400'], ['1', '2', '3']])('参数个数不符时报错并附语法：%j', (...args) => {
    expect(() => new InitCommand(new Workspace(), args)).toThrow('wrong number of arguments. usage: init [w] [h]');
  });

  it('参数不是数字时在构造阶段报错，先于正数校验', () => {
    expect(() => new InitCommand(new Workspace(), ['a', '600'])).toThrow('not a number: a');
    expect(() => new InitCommand(new Workspace(), ['0', 'a'])).toThrow('not a number: a');
  });

  it.each([
    ['0', '600'],
    ['800', '-1'],
  ])('尺寸 %s x %s 非正数时报错，已有文档不变', (w, h) => {
    const workspace = new Workspace();
    const old = new Document(800, 600);
    workspace.replace(old);
    expect(() => init(workspace, w, h)).toThrow('canvas size must be positive');
    expect(workspace.document()).toBe(old);
  });
});
