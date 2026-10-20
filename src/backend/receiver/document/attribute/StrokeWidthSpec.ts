import NumericSpec from './NumericSpec';

/** 线宽（stroke-width）：不得为负；与尺寸的区别在于缩放时不变（平移、缩放都沿用默认）。 */
export default class StrokeWidthSpec extends NumericSpec {
  override check(value: number): void {
    this.requireNonNegative(value);
  }
}
