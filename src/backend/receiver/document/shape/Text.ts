import CoordinateSpec from '../attribute/CoordinateSpec';
import StringSpec from '../attribute/StringSpec';
import Shape from './Shape';

/** 文字：内容 `text` 也在属性表中（可 set）；save 时写成子文本，随 SVG 读写落地。 */
export default class Text extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateSpec('x', 'x'), new CoordinateSpec('y', 'y'), new StringSpec('text')];
}
