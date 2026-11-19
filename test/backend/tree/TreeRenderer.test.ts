import { describe, expect, it } from 'vitest';
import { Document, TreeDecorator, TreeRenderer } from '../../../src/backend';
import type { TreeSuccess } from '../../../src/backend';
import { createShapeFactory } from '../../../src/host/defaults';
import { TestChangedDecorator, TestTypeDecorator } from '../../support/PublicTreeExtension';
import { Panel } from '../../support/SvgCompositeExtension';

describe('树渲染与经典 Decorator', () => {
  it('无装饰器保持根、子树及连线输出，只遍历文档节点', () => {
    const doc = new Document(100.5, 50);
    const group = doc.insert(createShapeFactory().create('g', 'g'));
    doc.insert(new Panel('p'), group);
    const renderer = new TreeRenderer();
    expect(renderer.render(doc)).toEqual(['svg (100.5x50)', '└── g#g', '    └── test-panel#p']);
    expect(renderer.render(doc, group)).toEqual(['g#g', '└── test-panel#p']);
  });

  it('列表顺序对应标签从左到右，反转顺序反转标签', () => {
    const doc = new Document(100, 100);
    const node = doc.insert(createShapeFactory().create('g', 'g'));
    const forward = new TreeRenderer([TestChangedDecorator, TestTypeDecorator]);
    const reverse = new TreeRenderer([TestTypeDecorator, TestChangedDecorator]);
    forward.notify('edit', doc);
    reverse.notify('edit', doc);
    expect(forward.render(doc, node)).toEqual(['g#g * (group)']);
    expect(reverse.render(doc, node)).toEqual(['g#g (group) *']);
  });

  it('装饰器状态保存在会话实例中，保存和替换通知可重置', () => {
    const doc = new Document(100, 100);
    const first = new TreeRenderer([TestChangedDecorator]);
    const second = new TreeRenderer([TestChangedDecorator]);
    first.notify('edit', doc);
    expect(first.render(doc)).toEqual(['svg (100x100) *']);
    expect(second.render(doc)).toEqual(['svg (100x100)']);
    first.notify('save', doc);
    expect(first.render(doc)).toEqual(['svg (100x100)']);
    first.notify('redo', doc);
    first.notify('replace', doc);
    expect(first.render(doc)).toEqual(['svg (100x100)']);
  });

  it('只读通知异常隔离，不中断后续装饰器', () => {
    const doc = new Document(100, 100);
    class Broken extends TreeDecorator {
      static override readonly decoratorName = 'broken';
      protected override tag(): null { return null; }
      override onSuccess(event: TreeSuccess): void {
        expect(Object.isFrozen(event)).toBe(true);
        expect(Object.isFrozen(event.nodes)).toBe(true);
        expect(Object.isFrozen(event.canvas)).toBe(true);
        throw new Error('observer failed');
      }
    }
    const renderer = new TreeRenderer([Broken, TestChangedDecorator]);
    expect(renderer.notify('edit', doc)).toEqual(['tree decorator broken: observer failed']);
    expect(renderer.render(doc)).toEqual(['svg (100x100) *']);
  });

  it('拒绝无名与同名装饰器', () => {
    class Unnamed extends TreeDecorator { protected override tag(): null { return null; } }
    expect(() => new TreeRenderer([Unnamed])).toThrow('declare decoratorName');
    expect(() => new TreeRenderer([TestTypeDecorator, TestTypeDecorator])).toThrow('duplicate tree decorator: test-type');
  });
});
