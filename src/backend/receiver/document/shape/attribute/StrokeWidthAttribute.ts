import Attribute from './Attribute';
import NumericAttribute from './NumericAttribute';

/** 线宽（stroke-width）：不得为负；平移、缩放都保持不变。 */
export default class StrokeWidthAttribute extends NumericAttribute {
  protected override validate(value: number): void {
    super.validate(value);
    this.requireNonNegative(value);
  }

  protected override recreate(value: number): Attribute<number> {
    return new StrokeWidthAttribute(this.name(), value);
  }
}
