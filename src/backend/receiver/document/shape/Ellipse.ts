import CoordinateSpec from '../attribute/CoordinateSpec';
import LengthSpec from '../attribute/LengthSpec';
import Shape from './Shape';

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
