import CommandResult from './CommandResult';
import EditorError from '../error/EditorError';
import DecimalFormat from '../receiver/document/attribute/DecimalFormat';

/**
 * Command 模式中的抽象命令。
 *
 * 静态成员即命令定义：子类覆盖 `command`（命令名）与 `usage`（语法），注册时由 Client 校验非空；
 * 构造函数即工厂：子类在构造时解析参数，每次执行都是一个独立对象。
 */
export default abstract class Command {
  static readonly command: string = '';
  static readonly usage: string = '';

  private static readonly decimal = new DecimalFormat();

  abstract execute(): CommandResult;

  /** 参数个数不在 allowed 之中时报错，并附上该命令的语法。 */
  protected expectArgCount(args: readonly string[], ...allowed: number[]): void {
    if (!allowed.includes(args.length)) {
      throw this.wrongArgCount();
    }
  }

  /** 参数个数不符的错误，附上语法；默认为本命令的 usage，参数随子类型变化的命令可传入更具体的语法。 */
  protected wrongArgCount(usage: string = this.definition().usage): EditorError {
    return new EditorError(`wrong number of arguments. usage: ${usage}`);
  }

  /** 解析十进制数字参数，规则见 DecimalFormat。 */
  protected parseNumber(token: string): number {
    return Command.decimal.parse(token);
  }

  /** 数值输出，规则见 DecimalFormat。 */
  protected formatNumber(n: number): string {
    return Command.decimal.format(n);
  }

  /** 本实例所属命令类的静态定义。 */
  protected definition(): typeof Command {
    return this.constructor as typeof Command;
  }
}
