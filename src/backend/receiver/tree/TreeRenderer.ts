import type Document from '../document/Document';
import type ShapeNode from '../document/ShapeNode';
import BaseTreeLineRenderer from './BaseTreeLineRenderer';
import TreeDecorator from './TreeDecorator';
import type TreeLineRenderer from './TreeLineRenderer';
import type { TreeSuccess } from './TreeLineRenderer';

export default class TreeRenderer {
  private readonly line: TreeLineRenderer;
  private readonly decorators: { name: string; instance: TreeDecorator }[] = [];

  constructor(classes: readonly (typeof TreeDecorator)[] = []) {
    let line: TreeLineRenderer = new BaseTreeLineRenderer();
    const names = new Set<string>();
    for (const cls of classes) {
      if (typeof cls !== 'function' || !(cls.prototype instanceof TreeDecorator) || !cls.decoratorName?.trim()) {
        throw new Error('tree decorator must extend TreeDecorator and declare decoratorName');
      }
      if (names.has(cls.decoratorName)) throw new Error(`duplicate tree decorator: ${cls.decoratorName}`);
      names.add(cls.decoratorName);
      // typeof TreeDecorator 带有抽象构造签名，此处构造的是已校验的子类。
      const instance = Reflect.construct(cls, [line]) as TreeDecorator;
      this.decorators.push({ name: cls.decoratorName, instance });
      line = instance;
    }
    this.line = line;
  }

  render(document: Document, root: ShapeNode | null = null): readonly string[] {
    const canvas = Object.freeze({ width: document.width(), height: document.height() });
    const lines = [this.line.render(root, canvas)];
    const draw = (children: readonly ShapeNode[], prefix: string): void => {
      children.forEach((child, index) => {
        const last = index === children.length - 1;
        lines.push(`${prefix}${last ? '└── ' : '├── '}${this.line.render(child, canvas)}`);
        draw(child.children(), `${prefix}${last ? '    ' : '│   '}`);
      });
    };
    draw(root === null ? document.children() : root.children(), '');
    return lines;
  }

  /** 通知异常作为展示警告，不将已提交的编辑误报为失败。 */
  notify(kind: TreeSuccess['kind'], document: Document): readonly string[] {
    const event: TreeSuccess = Object.freeze({
      kind, nodes: Object.freeze(document.nodes()),
      canvas: Object.freeze({ width: document.width(), height: document.height() }),
    });
    const warnings: string[] = [];
    for (const { name, instance } of this.decorators) {
      try { instance.onSuccess(event); }
      catch (error) { warnings.push(`tree decorator ${name}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return warnings;
  }
}
