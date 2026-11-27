import { NumericAttribute } from '../../src/backend';
import { LengthAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Ellipse extends Shape {
  static override readonly type = 'ellipse';
  static override readonly params = [
    new NumericAttribute('cx'),
    new NumericAttribute('cy'),
    new LengthAttribute('rx'),
    new LengthAttribute('ry'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['cx', 'cy'] as const;

  override move(dx: number, dy: number): void {
    this.assign('cx', this.number('cx') + dx);
    this.assign('cy', this.number('cy') + dy);
  }

  override scale(factor: number): void {
    this.assign('cx', this.number('cx') * factor);
    this.assign('cy', this.number('cy') * factor);
    this.assign('rx', this.number('rx') * factor);
    this.assign('ry', this.number('ry') * factor);
  }
}
