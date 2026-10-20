import NumericSpec from './NumericSpec';

/** 尺寸（width height r rx ry）：不得为负；平移不变，缩放时乘以系数。 */
export default class LengthSpec extends NumericSpec {
  override check(value: number): void {
    this.requireNonNegative(value);
  }

  override scale(value: number, factor: number): number {
    return value * factor;
  }
}
