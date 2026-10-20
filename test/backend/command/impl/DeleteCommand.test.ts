import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import DeleteCommand from '../../../../src/backend/command/impl/DeleteCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

/** 画布根下依次为 bg、title、markers{c1, box}。 */
function sample(): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  for (const line of [
    'rect bg 0 0 800 600 #fff',
    'text title 20 40 Title',
    'g markers',
    'circle c1 100 100 20 red in markers',
    'rect box 10 10 50 50 in markers',
  ]) {
    new CreateCommand(workspace, line.split(' ')).execute();
  }
  return workspace;
}

function ids(shapes: readonly { id(): string }[]): string[] {
  return shapes.map((shape) => shape.id());
}

describe('DeleteCommand 删除', () => {
  it('删除容器内的叶子：回显 deleted，从父容器中摘除', () => {
    const workspace = sample();
    expect(new DeleteCommand(workspace, ['box']).execute().lines()).toEqual(['rect#box deleted']);
    expect(ids(workspace.document().requireContainer('markers').children())).toEqual(['c1']);
    expect(workspace.document().find('box')).toBeNull();
  });

  it('undo 回到原父容器的原位置，回显 restored into 父容器', () => {
    const workspace = sample();
    const command = new DeleteCommand(workspace, ['c1']);
    command.execute();
    expect(command.undo().lines()).toEqual(['circle#c1 restored into g#markers']);
    expect(ids(workspace.document().requireContainer('markers').children())).toEqual(['c1', 'box']);
  });

  it('根级图形 undo 回显父节点为 svg，回到原位置', () => {
    const workspace = sample();
    const command = new DeleteCommand(workspace, ['title']);
    command.execute();
    expect(ids(workspace.document().children())).toEqual(['bg', 'markers']);
    expect(command.undo().lines()).toEqual(['text#title restored into svg']);
    expect(ids(workspace.document().children())).toEqual(['bg', 'title', 'markers']);
  });

  it('删除容器连同全部子孙，子孙 id 均不可再访问；undo 后全部恢复', () => {
    const workspace = sample();
    const doc = workspace.document();
    const command = new DeleteCommand(workspace, ['markers']);
    expect(command.execute().lines()).toEqual(['g#markers deleted']);
    for (const id of ['markers', 'c1', 'box']) {
      expect(() => doc.requireShape(id)).toThrow(`no such shape: ${id}`);
    }
    expect(command.undo().lines()).toEqual(['g#markers restored into svg']);
    expect(ids(doc.requireContainer('markers').children())).toEqual(['c1', 'box']);
    expect(doc.requireShape('box').parent()).toBe(doc.requireShape('markers'));
  });

  it('被删除的 id 可再次创建；undo 后再次 execute（redo）回显与首次相同', () => {
    const workspace = sample();
    const command = new DeleteCommand(workspace, ['bg']);
    const first = command.execute().lines();
    expect(() => new CreateCommand(workspace, 'g bg'.split(' ')).execute()).not.toThrow();
    new DeleteCommand(workspace, ['bg']).execute();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
  });

  it('id 不存在时报错，文档不变', () => {
    const workspace = sample();
    expect(() => new DeleteCommand(workspace, ['r9']).execute()).toThrow(new EditorError('no such shape: r9'));
    expect(ids(workspace.document().children())).toEqual(['bg', 'title', 'markers']);
  });

  it.each([[[]], [['a', 'b']]])('参数个数不符时报错并附语法：%j', (args) => {
    expect(() => new DeleteCommand(new Workspace(), args)).toThrow('wrong number of arguments. usage: delete <id>');
  });

  it('无文档时报无文档', () => {
    expect(() => new DeleteCommand(new Workspace(), ['r1']).execute()).toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', () => {
    expect(() => new DeleteCommand(sample(), ['bg']).undo()).toThrow('undo before execute');
  });
});
