import { describe, expect, it, vi } from 'vitest';
import { Client, Document, EditorError } from '../../../../src/backend';
import App from '../../../../src/App';
import type { Shape } from '../../../../src/backend';
import SetCommand from '../../../../plugins/commands/SetCommand';
import { createWorkspace } from '../../../../src/host/defaults';
import CompositeShape from '../../../support/CompositeShape';
import MemoryInputSource from '../../../support/MemoryInputSource';
import MemoryOutputSink from '../../../support/MemoryOutputSink';

class CompositeAttributes {
  static readonly handlerName: string = 'test-composite-attributes';

  static matches(shape: Shape, key: string): boolean {
    return shape instanceof CompositeShape && ['fill', 'label', 'title'].includes(key);
  }

  static apply(shape: Shape, key: string, token: string): void {
    const model = shape as CompositeShape;
    if (key === 'fill') model.setFill(token);
    else model.setLabel(token);
  }

  static display(shape: Shape, key: string): string | null {
    const model = shape as CompositeShape;
    return key === 'fill' ? model.frameShape().display('fill') : model.captionShape().display('text');
  }
}

function sample(model = new CompositeShape('panel')) {
  const workspace = createWorkspace();
  const doc = new Document(100, 100);
  const node = doc.insert(model);
  workspace.replace(doc);
  const client = new Client(workspace);
  client.register(SetCommand);
  return { workspace, doc, node, model, client };
}

describe('SetCommand 的静态 Handler', () => {
  it('fill 使用内部框体语义与领域回显，不调用模型默认 set/display', () => {
    const { workspace, model, client } = sample();
    workspace.attributeHandlerRegistry().register(CompositeAttributes);
    const fallback = vi.spyOn(model, 'set');
    const fallbackDisplay = vi.spyOn(model, 'display');
    expect(client.execute(['set', 'panel', 'fill', 'red']).lines()).toEqual(['g#panel updated: fill=red']);
    expect(model.frameShape().value('fill')).toBe('red');
    expect(model.value('fill')).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
    expect(fallbackDisplay).not.toHaveBeenCalled();
    expect(client.execute(['undo']).lines()).toEqual(['g#panel updated: fill unset']);
    expect(model.frameShape().value('fill')).toBeNull();
    client.execute(['redo']);
    expect(model.frameShape().value('fill')).toBe('red');
  });

  it.each(['label', 'title'])('%s 及别名保留输入 key，多轮撤销重做保持模型与节点身份', (key) => {
    const { workspace, doc, node, model, client } = sample();
    workspace.attributeHandlerRegistry().register(CompositeAttributes);
    expect(client.execute(['set', 'panel', key, 'new title']).lines()).toEqual([`g#panel updated: ${key}="new title"`]);
    for (let i = 0; i < 2; i++) {
      expect(client.execute(['undo']).lines()).toEqual([`g#panel updated: ${key}="label"`]);
      expect(model.captionShape().value('text')).toBe('label');
      client.execute(['redo']);
      expect(model.captionShape().value('text')).toBe('new title');
      expect(doc.requireNode('panel')).toBe(node);
      expect(node.value).toBe(model);
      expect(doc.nodes()).toEqual([node]);
    }
  });

  it('相同 g 标签的普通 Group 不会误命中，零命中保持默认属性和错误', () => {
    const { workspace, doc, client } = sample();
    workspace.attributeHandlerRegistry().register(CompositeAttributes);
    const group = workspace.shapes().create('g', 'group');
    doc.insert(group);
    expect(client.execute(['set', 'group', 'fill', 'green']).lines()).toEqual(['g#group updated: fill=green']);
    expect(group.value('fill')).toBe('green');
    expect(() => client.execute(['set', 'group', 'label', 'title'])).toThrow('unknown attribute: label');
    expect(() => client.execute(['set', 'panel', 'unknown', 'x'])).toThrow('unknown attribute: unknown');
    expect(() => sample().client.execute(['set', 'panel', 'label', 'title'])).toThrow('unknown attribute: label');
  });

  it('一次 set 修改多个私有部件，只有一个撤销单元', () => {
    const { workspace, model, client } = sample();
    class MultiPart extends CompositeAttributes {
      static override apply(shape: Shape, _key: string, token: string): void {
        const model = shape as CompositeShape;
        model.setFill(token);
        model.setLabel(token);
      }
    }
    workspace.attributeHandlerRegistry().register(MultiPart);
    client.execute(['set', 'panel', 'fill', 'red']);
    expect(model.frameShape().value('fill')).toBe('red');
    expect(model.captionShape().value('text')).toBe('red');
    client.execute(['undo']);
    expect(model.frameShape().value('fill')).toBeNull();
    expect(model.captionShape().value('text')).toBe('label');
    expect(() => client.execute(['undo'])).toThrow('nothing to undo');
    client.execute(['redo']);
    expect(model.frameShape().value('fill')).toBe('red');
    expect(model.captionShape().value('text')).toBe('red');
  });

  it('部分修改后失败整体恢复，不匹配后续项、不回退，保留 redo 并可重试', () => {
    const { workspace, model, client } = sample();
    let fail = true;
    class Broken extends CompositeAttributes {
      static override apply(shape: Shape, key: string, token: string): void {
        super.apply(shape, key, token);
        (shape as CompositeShape).setLabel('changed');
        if (fail) throw new Error('part failed');
      }
    }
    class Later extends CompositeAttributes {
      static override readonly handlerName = 'later';
      static override readonly matches = vi.fn(CompositeAttributes.matches);
      static override readonly apply = vi.fn();
    }
    workspace.attributeHandlerRegistry().register(Broken);
    workspace.attributeHandlerRegistry().register(Later);
    client.execute(['set', 'panel', 'stroke', 'blue']);
    client.execute(['undo']);
    Later.matches.mockClear();
    const fallback = vi.spyOn(model, 'set');
    expect(() => client.execute(['set', 'panel', 'fill', 'red'])).toThrow('part failed');
    expect(model.frameShape().value('fill')).toBeNull();
    expect(model.captionShape().value('text')).toBe('label');
    expect(Later.matches).not.toHaveBeenCalled();
    expect(Later.apply).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
    client.execute(['redo']);
    expect(model.value('stroke')).toBe('blue');
    fail = false;
    client.execute(['set', 'panel', 'fill', 'red']);
    client.execute(['undo']);
    expect(model.frameShape().value('fill')).toBeNull();
    expect(model.captionShape().value('text')).toBe('label');
    expect(model.value('stroke')).toBe('blue');
  });

  it('修改后展示失败恢复状态，失败 redo 保留历史并可重试', () => {
    const { workspace, model, client } = sample();
    let fail = false;
    class BrokenDisplay extends CompositeAttributes {
      static override display(shape: Shape, key: string): string | null {
        if (fail && (shape as CompositeShape).frameShape().value('fill') === 'red') {
          throw new Error('display failed');
        }
        return super.display(shape, key);
      }
    }
    workspace.attributeHandlerRegistry().register(BrokenDisplay);
    client.execute(['set', 'panel', 'fill', 'red']);
    client.execute(['undo']);
    fail = true;
    expect(() => client.execute(['redo'])).toThrow('display failed');
    expect(model.frameShape().value('fill')).toBeNull();
    expect(() => client.execute(['undo'])).toThrow('nothing to undo');
    fail = false;
    client.execute(['redo']);
    expect(model.frameShape().value('fill')).toBe('red');
    client.execute(['undo']);
    expect(model.frameShape().value('fill')).toBeNull();
  });

  it('旧值展示失败不执行修改，原有 undo 仍然有效', () => {
    const { workspace, model, client } = sample();
    client.execute(['set', 'panel', 'stroke', 'blue']);
    class BrokenDisplay extends CompositeAttributes {
      static override readonly apply = vi.fn();
      static override display(): string | null { throw new Error('old display failed'); }
    }
    workspace.attributeHandlerRegistry().register(BrokenDisplay);
    expect(() => client.execute(['set', 'panel', 'fill', 'red'])).toThrow('old display failed');
    expect(BrokenDisplay.apply).not.toHaveBeenCalled();
    expect(model.frameShape().value('fill')).toBeNull();
    client.execute(['undo']);
    expect(model.value('stroke')).toBeNull();
  });

  it('display 返回 null 仍为已处理，不回退模型规则', () => {
    const { workspace, model, client } = sample();
    class NullDisplay extends CompositeAttributes {
      static override display(): string | null { return null; }
    }
    workspace.attributeHandlerRegistry().register(NullDisplay);
    const fallback = vi.spyOn(model, 'set');
    expect(client.execute(['set', 'panel', 'fill', 'red']).lines()).toEqual(['g#panel updated: fill=null']);
    expect(model.frameShape().value('fill')).toBe('red');
    expect(fallback).not.toHaveBeenCalled();
    expect(client.execute(['undo']).lines()).toEqual(['g#panel updated: fill unset']);
  });

  it('匹配抛错直接失败，模型与现有历史不变', () => {
    const { workspace, model, client } = sample();
    client.execute(['set', 'panel', 'stroke', 'blue']);
    class BrokenMatch extends CompositeAttributes {
      static override matches(): boolean { throw new Error('match failed'); }
      static override readonly apply = vi.fn();
    }
    workspace.attributeHandlerRegistry().register(BrokenMatch);
    expect(() => client.execute(['set', 'panel', 'fill', 'red'])).toThrow('match failed');
    expect(BrokenMatch.apply).not.toHaveBeenCalled();
    expect(model.frameShape().value('fill')).toBeNull();
    client.execute(['undo']);
    expect(model.value('stroke')).toBeNull();
  });

  it('默认模型 set 的部分失败同样通过当前模型快照恢复', () => {
    class BrokenModel extends CompositeShape {
      override set(key: string, token: string): void {
        super.set(key, token);
        throw new Error('model failed');
      }
    }
    const { model, client } = sample(new BrokenModel('panel'));
    expect(() => client.execute(['set', 'panel', 'fill', 'red'])).toThrow('model failed');
    expect(model.value('fill')).toBeNull();
    expect(() => client.execute(['undo'])).toThrow('nothing to undo');
  });

  it('再次执行失败不覆盖上一次有效撤销记录', () => {
    const { workspace, model } = sample();
    let fail = false;
    class Retry extends CompositeAttributes {
      static override apply(shape: Shape, key: string, token: string): void {
        super.apply(shape, key, token);
        if (fail) {
          (shape as CompositeShape).setLabel('partial');
          throw new Error('retry failed');
        }
      }
    }
    workspace.attributeHandlerRegistry().register(Retry);
    const command = new SetCommand(workspace, ['panel', 'fill', 'red']);
    command.execute();
    fail = true;
    expect(() => command.execute()).toThrow('retry failed');
    expect(model.frameShape().value('fill')).toBe('red');
    expect(model.captionShape().value('text')).toBe('label');
    expect(command.undo().lines()).toEqual(['g#panel updated: fill unset']);
    expect(model.frameShape().value('fill')).toBeNull();
  });

  it('Handler 的领域错误经 CLI 回显后仍可继续撤销和重做', async () => {
    const { workspace, model, client } = sample();
    class InvalidEdit extends CompositeAttributes {
      static override apply(shape: Shape, key: string, token: string): void {
        super.apply(shape, key, token);
        throw new EditorError('invalid composite edit');
      }
    }
    workspace.attributeHandlerRegistry().register(InvalidEdit);
    client.execute(['set', 'panel', 'stroke', 'blue']);
    const output = new MemoryOutputSink();
    await new App(new MemoryInputSource(['set panel fill red', 'undo', 'redo'], false), output, client).run();
    expect(output.lines().slice(1)).toEqual([
      'svg> set panel fill red', 'error: invalid composite edit',
      'svg> undo', 'g#panel updated: stroke unset',
      'svg> redo', 'g#panel updated: stroke=blue',
    ]);
    expect(model.frameShape().value('fill')).toBeNull();
    expect(model.value('stroke')).toBe('blue');
  });
});
