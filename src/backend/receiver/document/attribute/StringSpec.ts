import AttributeSpec from './AttributeSpec';

/** 字符串属性（fill stroke）：不校验，原样保存与展示。 */
export default class StringSpec extends AttributeSpec<string> {
  parse(token: string): string {
    return token;
  }

  display(value: string): string {
    return value;
  }
}
