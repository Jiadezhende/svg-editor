import { describe, expect, it } from 'vitest';
import AddtoCommand from '../../../../src/backend/command/impl/AddtoCommand';
import BackCommand from '../../../../src/backend/command/impl/BackCommand';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import FrontCommand from '../../../../src/backend/command/impl/FrontCommand';
import Document from '../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';
import EditorError from '../../../../src/backend/error/EditorError';

/** 根下依次为 bg、title、markers{c1, box, inner{dot}}。 */
function sample(): Workspace {
  const workspace = new Workspace();
  workspace.replace(new Document(800, 600));
  for (const line of [
    'rect bg 0 0 800 600',
    'text title 20 40 Title',
    'g markers',
    'circle c1 100 100 20 in markers',
    'rect box 10 10 50 50 in markers',
    'g inner in markers',
    'circle dot 1 1 1 in inner',
  ]) {
    new CreateCommand(workspace, line.split(' ')).execute();
  }
  return workspace;
}

function ids(workspace: Workspace, containerId?: string): string[] {
  const doc = workspace.document();
  const container = containerId === undefined ? doc : doc.requireContainer(containerId);
  return container.children().map((shape) => shape.id());
}

describe('FrontCommand / BackCommand', () => {
  it('front 移到兄弟末尾（最上层），undo 回到原位置', () => {
    const workspace = sample();
    const command = new FrontCommand(workspace, ['bg']);
    expect(command.execute().lines()).toEqual(['rect#bg brought to front']);
    expect(ids(workspace)).toEqual(['title', 'markers', 'bg']);
    expect(command.undo().lines()).toEqual(['rect#bg restored into svg']);
    expect(ids(workspace)).toEqual(['bg', 'title', 'markers']);
  });

  it('back 移到兄弟开头（最下层），undo 回到原位置', () => {
    const workspace = sample();
    const command = new BackCommand(workspace, ['box']);
    expect(command.execute().lines()).toEqual(['rect#box sent to back']);
    expect(ids(workspace, 'markers')).toEqual(['box', 'c1', 'inner']);
    expect(command.undo().lines()).toEqual(['rect#box restored into g#markers']);
    expect(ids(workspace, 'markers')).toEqual(['c1', 'box', 'inner']);
  });

  it('已在最上层 / 最下层时位置不变', () => {
    const workspace = sample();
    new FrontCommand(workspace, ['markers']).execute();
    new BackCommand(workspace, ['bg']).execute();
    expect(ids(workspace)).toEqual(['bg', 'title', 'markers']);
  });

  it('undo 后再次 execute（redo）回显与首次相同', () => {
    const workspace = sample();
    const command = new FrontCommand(workspace, ['c1']);
    const first = command.execute().lines();
    command.undo();
    expect(command.execute().lines()).toEqual(first);
    expect(ids(workspace, 'markers')).toEqual(['box', 'inner', 'c1']);
  });

  it('id 不存在时报错；参数个数在构造时校验', () => {
    expect(() => new FrontCommand(sample(), ['r9']).execute()).toThrow(new EditorError('no such shape: r9'));
    expect(() => new BackCommand(new Workspace(), [])).toThrow('wrong number of arguments. usage: back <id>');
  });
});

describe('AddtoCommand', () => {
  it('把图形移入容器作为最后一个子节点；undo 回到原父容器的原位置', () => {
    const workspace = sample();
    const command = new AddtoCommand(workspace, ['inner', 'title']);
    expect(command.execute().lines()).toEqual(['text#title added to g#inner']);
    expect(ids(workspace)).toEqual(['bg', 'markers']);
    expect(ids(workspace, 'inner')).toEqual(['dot', 'title']);
    expect(command.undo().lines()).toEqual(['text#title restored into svg']);
    expect(ids(workspace)).toEqual(['bg', 'title', 'markers']);
    expect(ids(workspace, 'inner')).toEqual(['dot']);
  });

  it('目标已是其父容器时移到该容器末尾，不报错', () => {
    const workspace = sample();
    expect(new AddtoCommand(workspace, ['markers', 'c1']).execute().lines()).toEqual(['circle#c1 added to g#markers']);
    expect(ids(workspace, 'markers')).toEqual(['box', 'inner', 'c1']);
  });

  it('容器连同子树一起移动', () => {
    const workspace = sample();
    new CreateCommand(workspace, 'g other'.split(' ')).execute();
    new AddtoCommand(workspace, ['other', 'inner']).execute();
    expect(workspace.document().requireShape('dot').parent()).toBe(workspace.document().requireShape('inner'));
    expect(ids(workspace, 'other')).toEqual(['inner']);
  });

  it('目标是图形自身或其子孙时报错，文档不变', () => {
    const workspace = sample();
    expect(() => new AddtoCommand(workspace, ['inner', 'markers']).execute()).toThrow(
      new EditorError('cannot add a container into itself or its descendant: markers'),
    );
    expect(() => new AddtoCommand(workspace, ['markers', 'markers']).execute()).toThrow('itself or its descendant');
    expect(ids(workspace)).toEqual(['bg', 'title', 'markers']);
  });

  it('目标不是容器 / 不存在、图形不存在时报错', () => {
    const workspace = sample();
    expect(() => new AddtoCommand(workspace, ['bg', 'c1']).execute()).toThrow(new EditorError('not a container: bg'));
    expect(() => new AddtoCommand(workspace, ['g9', 'c1']).execute()).toThrow(new EditorError('no such shape: g9'));
    expect(() => new AddtoCommand(workspace, ['markers', 'r9']).execute()).toThrow(new EditorError('no such shape: r9'));
  });

  it('参数个数在构造时校验；无文档时报无文档', () => {
    expect(() => new AddtoCommand(new Workspace(), ['g1'])).toThrow('wrong number of arguments. usage: addto <gid> <id>');
    expect(() => new AddtoCommand(new Workspace(), ['g1', 'r1']).execute()).toThrow("no document. use 'init' or 'read' first");
  });

  it('execute 之前 undo 属于程序缺陷', () => {
    expect(() => new AddtoCommand(sample(), ['markers', 'bg']).undo()).toThrow('undo before execute');
  });
});
