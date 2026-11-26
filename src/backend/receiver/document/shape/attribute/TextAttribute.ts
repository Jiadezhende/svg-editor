import Attribute from './Attribute';
import StringAttribute from './StringAttribute';

/** 文本内容（text 的 `text`）：与 StringAttribute 的区别在展示时加双引号；保存的值本身不带引号。 */
export default class TextAttribute extends StringAttribute {
  protected override format(value: string): string {
    return `"${value}"`;
  }

  protected override recreate(value: string): Attribute<string> {
    return new TextAttribute(this.name(), value);
  }
}
