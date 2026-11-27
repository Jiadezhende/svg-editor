import { NumericAttribute } from '../../src/backend';
import { TextAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

/** 文字：内容 `text` 也在属性表中（可 set），在 SVG 中写成子文本。 */
export default class Text extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new NumericAttribute('x'), new NumericAttribute('y'), new TextAttribute('text')];
  static override readonly anchor = ['x', 'y'] as const;
  static override readonly content = 'text';

  override move(dx: number, dy: number): void {
    this.assign('x', this.number('x') + dx);
    this.assign('y', this.number('y') + dy);
  }

  /** 缩放位置，文字内容与字号无关。 */
  override scale(factor: number): void {
    this.assign('x', this.number('x') * factor);
    this.assign('y', this.number('y') * factor);
  }
}
