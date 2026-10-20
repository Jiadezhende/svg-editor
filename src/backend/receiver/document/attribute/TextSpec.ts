import StringSpec from './StringSpec';

/** 文本内容（text 的 `text`）：与 StringSpec 的区别在输出时加双引号。 */
export default class TextSpec extends StringSpec {
  override format(value: string): string {
    return `"${value}"`;
  }
}
