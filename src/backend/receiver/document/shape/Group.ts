import Shape from './Shape';
import type { AttributeValue } from '../attribute/AttributeSpec';

/** 普通分组：复用 Shape 的组成与递归行为，允许自由编辑成员。 */
export default class Group extends Shape {
  static override readonly type = 'g';

  constructor(id: string, values: ReadonlyMap<string, AttributeValue> = new Map()) {
    super(id, values, []);
  }

  protected override coreDetail(): string {
    return `children=${this.children().length}`;
  }
}
