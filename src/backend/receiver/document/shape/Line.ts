import CoordinateSpec from '../attribute/CoordinateSpec';
import Shape from './Shape';

export default class Line extends Shape {
  static override readonly type = 'line';
  static override readonly params = [
    new CoordinateSpec('x1', 'x'),
    new CoordinateSpec('y1', 'y'),
    new CoordinateSpec('x2', 'x'),
    new CoordinateSpec('y2', 'y'),
  ];
  static override readonly paint = 'stroke';
}
