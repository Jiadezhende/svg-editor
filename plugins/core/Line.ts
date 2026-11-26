import { NumericAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Line extends Shape {
  static override readonly type = 'line';
  static override readonly params = [
    new NumericAttribute('x1'),
    new NumericAttribute('y1'),
    new NumericAttribute('x2'),
    new NumericAttribute('y2'),
  ];
  static override readonly paint = 'stroke';
  static override readonly anchor = ['x1', 'y1'] as const;

  override move(dx: number, dy: number): void {
    this.assign('x1', this.number('x1') + dx);
    this.assign('y1', this.number('y1') + dy);
    this.assign('x2', this.number('x2') + dx);
    this.assign('y2', this.number('y2') + dy);
  }

  override scale(factor: number): void {
    this.assign('x1', this.number('x1') * factor);
    this.assign('y1', this.number('y1') * factor);
    this.assign('x2', this.number('x2') * factor);
    this.assign('y2', this.number('y2') * factor);
  }
}
