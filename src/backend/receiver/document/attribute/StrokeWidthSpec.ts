import NumericSpec from './NumericSpec';

/** 线宽（stroke-width）：不得为负；与尺寸的区别在缩放行为，随 scale 确定。 */
export default class StrokeWidthSpec extends NumericSpec {
  override check(value: number): void {
    this.requireNonNegative(value);
  }
}
