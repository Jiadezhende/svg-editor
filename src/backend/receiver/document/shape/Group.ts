import ChildList from '../ChildList';
import type Container from '../Container';
import Shape from './Shape';

/** Composite：容器 `g`，查找作用于整棵子树。 */
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

  override asContainer(): Container {
    return this;
  }
}
