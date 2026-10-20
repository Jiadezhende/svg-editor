import CoordinateSpec from '../attribute/CoordinateSpec';
import LengthSpec from '../attribute/LengthSpec';
import Shape from './Shape';

export default class Circle extends Shape {
  static override readonly type = 'circle';
  static override readonly params = [new CoordinateSpec('cx', 'x'), new CoordinateSpec('cy', 'y'), new LengthSpec('r')];
  static override readonly paint = 'fill';
}
