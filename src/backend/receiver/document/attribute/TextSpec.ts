import StringSpec from './StringSpec';

/** 文本内容（text 的 `text`）：与 StringSpec 的区别在展示时加双引号；保存的值本身不带引号。 */
export default class TextSpec extends StringSpec {
  override display(value: string): string {
    return `"${value}"`;
  }
}
