import type { Axis } from './AttributeSpec';
import NumericSpec from './NumericSpec';

/** 坐标（x y cx cy x1 y1 x2 y2）：任意数值；平移时按轴加上偏移，缩放时乘以系数。 */
export default class CoordinateSpec extends NumericSpec {
  constructor(
    name: string,
    private readonly coordinateAxis: Axis,
  ) {
    super(name);
  }

  override axis(): Axis {
    return this.coordinateAxis;
  }

  override translate(value: number, dx: number, dy: number): number {
    return value + (this.coordinateAxis === 'x' ? dx : dy);
  }

  override scale(value: number, factor: number): number {
    return value * factor;
  }
}
