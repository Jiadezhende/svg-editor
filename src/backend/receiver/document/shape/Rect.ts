import CoordinateSpec from '../attribute/CoordinateSpec';
import LengthSpec from '../attribute/LengthSpec';
import Shape from './Shape';

export default class Rect extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new CoordinateSpec('x', 'x'),
    new CoordinateSpec('y', 'y'),
    new LengthSpec('width'),
    new LengthSpec('height'),
  ];
  static override readonly paint = 'fill';
}
