import EditorError from '../../../error/EditorError';

/**
 * 十进制数值的文本规则，命令参数与数值属性共用一份。
 * 解析：允许正负号与小数，不接受空串、指数、Infinity 等写法；
 * 输出：整数不带小数点，浮点最多 6 位小数并去掉末尾 0，`-0` 输出 `0`。
 */
export default class DecimalFormat {
  parse(token: string): number {
    const value = this.tryParse(token);
    if (value === null) {
      throw new EditorError(`not a number: ${token}`);
    }
    return value;
  }

  /** 不符合规则时返回 null，供"解析不了即视为未声明"的场合使用。 */
  tryParse(token: string): number | null {
    return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(token) ? Number(token) : null;
  }

  format(n: number): string {
    const rounded = Number(n.toFixed(6));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }
}
