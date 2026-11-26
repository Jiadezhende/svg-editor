import Attribute from './Attribute';
import NumericAttribute from './NumericAttribute';

/** 尺寸（width height r rx ry）：不得为负；平移不变，缩放时乘以系数。 */
export default class LengthAttribute extends NumericAttribute {
  protected override validate(value: number): void {
    super.validate(value);
    this.requireNonNegative(value);
  }

  override scale(factor: number): Attribute<number> {
    if (this.value === null) return this;
    return this.withValue(this.value * factor);
  }

  protected override recreate(value: number): Attribute<number> {
    return new LengthAttribute(this.name(), value);
  }
}
