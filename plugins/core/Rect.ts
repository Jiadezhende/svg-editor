import { CoordinateSpec } from '../../src/backend';
import { LengthSpec } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Rect extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new CoordinateSpec('x', 'x'),
    new CoordinateSpec('y', 'y'),
    new LengthSpec('width'),
    new LengthSpec('height'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['x', 'y'] as const;
}
