import ChildList from '../ChildList';
import type Container from '../Container';
import Shape from './Shape';
import type ShapeMemento from './ShapeMemento';

/** Composite：容器 `g`，查找、平移、缩放、快照都作用于整棵子树。 */
export default class Group extends Shape implements Container {
  static override readonly type = 'g';

  private readonly members = new ChildList(this);

  children(): readonly Shape[] {
    return this.members.all();
  }

  insert(shape: Shape, index?: number): void {
    this.members.insert(shape, index);
  }

  remove(shape: Shape): number {
    return this.members.remove(shape);
  }

  override find(id: string): Shape | null {
    return super.find(id) ?? this.members.find(id);
  }

  override move(dx: number, dy: number): void {
    super.move(dx, dy);
    for (const child of this.members.all()) {
      child.move(dx, dy);
    }
  }

  override scale(factor: number): void {
    super.scale(factor);
    for (const child of this.members.all()) {
      child.scale(factor);
    }
  }

  override capture(): ShapeMemento {
    return super.capture().with(this.members.all().map((child) => child.capture()));
  }

  override asContainer(): Container {
    return this;
  }

  /** show 的核心属性行：容器没有核心属性，显示子节点个数。 */
  protected override coreDetail(): string {
    return `children=${this.members.all().length}`;
  }
}
