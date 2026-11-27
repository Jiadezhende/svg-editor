import { Shape } from '../../src/backend';

/** 普通 SVG 分组；成员关系属于 Document，自身没有参与变换的属性。 */
export default class Group extends Shape {
  static override readonly type = 'g';

  override acceptsChildren(): boolean {
    return true;
  }

  override move(_dx: number, _dy: number): void {}

  override scale(_factor: number): void {}
}
