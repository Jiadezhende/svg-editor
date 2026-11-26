import DecimalFormat from '../../../../utils/DecimalFormat';
import EditorError from '../../../../error/EditorError';
import Attribute from './Attribute';

/** 数值属性：按十进制数字解析，按数值格式展示，值必须有限。 */
export default abstract class NumericAttribute extends Attribute<number> {
  private static readonly decimal = new DecimalFormat();

  override defaultValue(): number {
    return 0;
  }

  protected override parse(token: string): number {
    return NumericAttribute.decimal.parse(token);
  }

  protected override format(value: number): string {
    return NumericAttribute.decimal.format(value);
  }

  protected override validate(value: number): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new EditorError(`${this.name()} must be a finite number`);
    }
  }

  /** 供不得为负的子类使用。 */
  protected requireNonNegative(value: number): void {
    if (value < 0) {
      throw new EditorError(`${this.name()} must be non-negative`);
    }
  }
}
