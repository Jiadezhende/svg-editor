import { CoordinateAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Line extends Shape {
  static override readonly type = 'line';
  static override readonly params = [
    new CoordinateAttribute('x1', 'x'),
    new CoordinateAttribute('y1', 'y'),
    new CoordinateAttribute('x2', 'x'),
    new CoordinateAttribute('y2', 'y'),
  ];
  static override readonly paint = 'stroke';
  static override readonly anchor = ['x1', 'y1'] as const;
}
