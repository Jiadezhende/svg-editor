import NumericSpec from './NumericSpec';

/** 坐标所在的轴，move 按轴平移。 */
export type Axis = 'x' | 'y';

/** 坐标（x y cx cy x1 y1 x2 y2）：任意数值。 */
export default class CoordinateSpec extends NumericSpec {
  constructor(
    name: string,
    private readonly coordinateAxis: Axis,
  ) {
    super(name);
  }

  axis(): Axis {
    return this.coordinateAxis;
  }
}
