import { CoordinateAttribute } from '../../src/backend';
import { LengthAttribute } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Ellipse extends Shape {
  static override readonly type = 'ellipse';
  static override readonly params = [
    new CoordinateAttribute('cx', 'x'),
    new CoordinateAttribute('cy', 'y'),
    new LengthAttribute('rx'),
    new LengthAttribute('ry'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['cx', 'cy'] as const;
}
