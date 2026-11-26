import { NumericAttribute } from '../../src/backend';
import { LengthAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Rect extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new NumericAttribute('x'),
    new NumericAttribute('y'),
    new LengthAttribute('width'),
    new LengthAttribute('height'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['x', 'y'] as const;

  override move(dx: number, dy: number): void {
    this.assign('x', this.number('x') + dx);
    this.assign('y', this.number('y') + dy);
  }

  override scale(factor: number): void {
    this.assign('x', this.number('x') * factor);
    this.assign('y', this.number('y') * factor);
    this.assign('width', this.number('width') * factor);
    this.assign('height', this.number('height') * factor);
  }
}
