import { Shape } from '../../src/backend';

/** 普通 SVG 分组；成员关系属于 Document，不保存在模型中。 */
export default class Group extends Shape {
  static override readonly type = 'g';

  override acceptsChildren(): boolean {
    return true;
  }
}
