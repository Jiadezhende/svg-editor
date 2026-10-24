import CoordinateSpec from '../attribute/CoordinateSpec';
import TextSpec from '../attribute/TextSpec';
import Shape from './Shape';

/** 文字：内容 `text` 也在属性表中（可 set），在 SVG 中写成子文本。 */
export default class Text extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateSpec('x', 'x'), new CoordinateSpec('y', 'y'), new TextSpec('text')];
  static override readonly anchor = ['x', 'y'] as const;
  static override readonly content = 'text';
}
