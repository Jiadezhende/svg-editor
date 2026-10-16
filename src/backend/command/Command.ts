import CommandResult from '../../common/CommandResult';
import EditorError from '../../common/EditorError';

/**
 * Command 模式中的抽象命令。
 *
 * 静态成员即命令定义：子类覆盖 `command`（命令名）与 `usage`（语法），注册时由 Client 校验非空；
 * 构造函数即工厂：子类在构造时解析参数，每次执行都是一个独立对象。
 */
export default abstract class Command {
  static readonly command: string = '';
  static readonly usage: string = '';

  abstract execute(): CommandResult;

  /** 参数个数不在 allowed 之中时报错，并附上该命令的语法。 */
  protected expectArgCount(args: readonly string[], ...allowed: number[]): void {
    if (!allowed.includes(args.length)) {
      throw new EditorError(`wrong number of arguments. usage: ${this.definition().usage}`);
    }
  }

  /** 解析十进制数字参数：允许正负号与小数，不接受空串、指数、Infinity 等写法。 */
  protected parseNumber(token: string): number {
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(token)) {
      throw new EditorError(`not a number: ${token}`);
    }
    return Number(token);
  }

  /** 数值输出：整数不带小数点，浮点最多 6 位小数并去掉末尾 0，`-0` 输出 `0`。 */
  protected formatNumber(n: number): string {
    const rounded = Number(n.toFixed(6));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  /** 本实例所属命令类的静态定义。 */
  protected definition(): typeof Command {
    return this.constructor as typeof Command;
  }
}
