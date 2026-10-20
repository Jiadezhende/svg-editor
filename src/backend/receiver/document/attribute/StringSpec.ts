import AttributeSpec from './AttributeSpec';

/** 字符串属性（fill stroke text）：不校验，原样保存与输出。 */
export default class StringSpec extends AttributeSpec<string> {
  parse(token: string): string {
    return token;
  }

  format(value: string): string {
    return value;
  }
}
