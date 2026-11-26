import { CoordinateAttribute } from '../../src/backend';
import { LengthAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Rect extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new CoordinateAttribute('x', 'x'),
    new CoordinateAttribute('y', 'y'),
    new LengthAttribute('width'),
    new LengthAttribute('height'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['x', 'y'] as const;
}
