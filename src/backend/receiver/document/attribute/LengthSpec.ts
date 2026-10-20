import NumericSpec from './NumericSpec';

/** 尺寸（width height r rx ry）：不得为负。 */
export default class LengthSpec extends NumericSpec {
  override check(value: number): void {
    this.requireNonNegative(value);
  }
}
