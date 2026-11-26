import Attribute, { type Axis } from './Attribute';
import NumericAttribute from './NumericAttribute';

/** 坐标（x y cx cy x1 y1 x2 y2）：任意数值，并记录所在的轴。 */
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

  protected override recreate(value: number): Attribute<number> {
    return new CoordinateAttribute(this.name(), this.coordinateAxis, value);
  }
}
