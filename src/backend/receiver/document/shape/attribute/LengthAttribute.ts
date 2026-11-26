import Attribute from './Attribute';
import NumericAttribute from './NumericAttribute';

/** 尺寸（width height r rx ry）：任意有限数值，但不得为负。 */
export default class LengthAttribute extends NumericAttribute {
  protected override validate(value: number): void {
    super.validate(value);
    this.requireNonNegative(value);
  }

  protected override recreate(value: number): Attribute<number> {
    return new LengthAttribute(this.name(), value);
  }
}
