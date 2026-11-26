import { CoordinateAttribute } from '../../src/backend';
import { LengthAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Circle extends Shape {
  static override readonly type = 'circle';
  static override readonly params = [new CoordinateAttribute('cx', 'x'), new CoordinateAttribute('cy', 'y'), new LengthAttribute('r')];
  static override readonly paint = 'fill';
  static override readonly anchor = ['cx', 'cy'] as const;
}
