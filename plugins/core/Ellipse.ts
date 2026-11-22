import { CoordinateSpec } from '../../src/backend';
import { LengthSpec } from '../../src/backend';
import { Shape } from '../../src/backend';

export default class Ellipse extends Shape {
  static override readonly type = 'ellipse';
  static override readonly params = [
    new CoordinateSpec('cx', 'x'),
    new CoordinateSpec('cy', 'y'),
    new LengthSpec('rx'),
    new LengthSpec('ry'),
  ];
  static override readonly paint = 'fill';
  static override readonly anchor = ['cx', 'cy'] as const;
}
