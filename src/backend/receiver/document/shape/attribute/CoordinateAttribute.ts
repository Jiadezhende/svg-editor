import Attribute, { type Axis } from './Attribute';
import NumericAttribute from './NumericAttribute';

/** 坐标（x y cx cy x1 y1 x2 y2）：任意数值；平移按轴加上偏移，缩放时乘以系数。 */
export default class CoordinateAttribute extends NumericAttribute {
  constructor(
    name: string,
    private readonly coordinateAxis: Axis,
    value: number | null = null,
  ) {
    super(name, value);
  }

  override axis(): Axis {
    return this.coordinateAxis;
  }

  override translate(dx: number, dy: number): Attribute<number> {
    if (this.value === null) return this;
    return this.withValue(this.value + (this.coordinateAxis === 'x' ? dx : dy));
  }

  override scale(factor: number): Attribute<number> {
    if (this.value === null) return this;
    return this.withValue(this.value * factor);
  }

  protected override recreate(value: number): Attribute<number> {
    return new CoordinateAttribute(this.name(), this.coordinateAxis, value);
  }
}
