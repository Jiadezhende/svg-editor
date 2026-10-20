import type Container from './Container';
import type Shape from './shape/Shape';

/**
 * 子节点序列，由 Document 与 Group 组合复用：维护顺序，插入 / 摘除时同步子图形的父节点。
 * 插入已有父节点的图形、摘除不在序列中的图形属于程序缺陷。
 */
export default class ChildList {
  private readonly items: Shape[] = [];

  constructor(private readonly owner: Container) {}

  all(): readonly Shape[] {
    return this.items;
  }

  insert(shape: Shape, index: number = this.items.length): void {
    shape.attachTo(this.owner);
    this.items.splice(index, 0, shape);
  }

  remove(shape: Shape): number {
    const index = this.items.indexOf(shape);
    if (index < 0) {
      throw new Error(`${shape.label()} is not a child of ${this.owner.label()}`);
    }
    this.items.splice(index, 1);
    shape.detach();
    return index;
  }

  /** 在各子图形的子树中按 id 查找。 */
  find(id: string): Shape | null {
    for (const child of this.items) {
      const found = child.find(id);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
}
