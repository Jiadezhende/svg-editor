import { describe, expect, it } from 'vitest';
import { Document, Shape } from '../../src/backend';
import type { ShapeView } from '../../src/backend';
import activate, { StatsCommand } from '../../plugins/stats/index';

class Rect extends Shape {
  static override readonly type = 'rect';
  override move(): void {}
  override scale(): void {}
}
class Text extends Shape {
  static override readonly type = 'text';
  override move(): void {}
  override scale(): void {}
}

class Container extends Shape {
  static override readonly type = 'container';
  override acceptsChildren(): boolean { return true; }
  override move(): void {}
  override scale(): void {}
  override identifiers(): readonly string[] { return [this.id(), `${this.id()}-text`]; }
  protected override viewParts(): readonly ShapeView[] { return [new Text(`${this.id()}-text`).view()]; }
}

describe('stats 插件', () => {
  it('以深度优先首次出现排序，包含私有部件和空容器', () => {
    const document = new Document(10, 10);
    const command = new StatsCommand({ document: () => document }, []);
    expect(activate().commands).toEqual([StatsCommand]);
    expect(command.execute().lines()).toEqual(['(total 0, containers 0)']);
    const group = document.insert(new Container('group'));
    document.insert(new Rect('rect'), group);
    document.insert(new Container('nested'), group);
    document.insert(new Rect('last'));
    expect(command.execute().lines()).toEqual(['text: 2  rect: 2  (total 4, containers 2)']);
    expect(() => new StatsCommand({ document: () => document }, ['extra'])).toThrow('usage: stats');
  });
});
