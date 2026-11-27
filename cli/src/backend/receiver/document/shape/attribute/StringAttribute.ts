import Attribute from './Attribute';
import EditorError from '../../../../error/EditorError';

/** 字符串属性（fill stroke）：原样保存与展示。 */
export default class StringAttribute extends Attribute<string> {
  override defaultValue(): string {
    return '';
  }

  protected override parse(token: string): string {
    return token;
  }

  protected override validate(value: string): void {
    if (typeof value !== 'string') throw new EditorError(`${this.name()} must be a string`);
  }

  protected override format(value: string): string {
    return value;
  }

  protected override recreate(value: string): Attribute<string> {
    return new StringAttribute(this.name(), value);
  }
}
