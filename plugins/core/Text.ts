import { CoordinateAttribute } from '../../src/backend';
import { TextAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

/** 文字：内容 `text` 也在属性表中（可 set），在 SVG 中写成子文本。 */
export default class Text extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new TextAttribute('text')];
  static override readonly anchor = ['x', 'y'] as const;
  static override readonly content = 'text';
}
