import AttributeSpec from './AttributeSpec';
import DecimalFormat from './DecimalFormat';
import EditorError from '../../../error/EditorError';

/** 数值属性：按十进制数字解析，按数值格式展示。 */
export default abstract class NumericSpec extends AttributeSpec<number> {
  private static readonly decimal = new DecimalFormat();

  defaultValue(): number {
    return 0;
  }

  parse(token: string): number {
    return NumericSpec.decimal.parse(token);
  }

  display(value: number): string {
    return NumericSpec.decimal.format(value);
  }

  /** 供不得为负的子类使用。 */
  protected requireNonNegative(value: number): void {
    if (value < 0) {
      throw new EditorError(`${this.name()} must be non-negative`);
    }
  }
}
