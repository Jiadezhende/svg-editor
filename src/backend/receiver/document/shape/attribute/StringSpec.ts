import AttributeSpec from './AttributeSpec';
import EditorError from '../../../../error/EditorError';

/** 字符串属性（fill stroke）：原样保存与展示。 */
export default class StringSpec extends AttributeSpec<string> {
  defaultValue(): string {
    return '';
  }

  parse(token: string): string {
    return token;
  }

  override check(value: string): void {
    if (typeof value !== 'string') throw new EditorError(`${this.name()} must be a string`);
  }

  display(value: string): string {
    return value;
  }
}
