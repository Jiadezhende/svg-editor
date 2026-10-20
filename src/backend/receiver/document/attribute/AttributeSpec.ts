/** 属性值：数值属性为 number，其余为原样保存的 string。 */
export type AttributeValue = number | string;

/**
 * 属性种类：一个属性的值如何解析、须满足什么约束、如何输出。
 * 按"值在各通用操作下的行为"划分子类；各图形类以静态属性表声明自己有哪些属性、各属哪一种类。
 * 平移 / 缩放随 move / scale 补入。
 */
export default abstract class AttributeSpec<T extends AttributeValue = AttributeValue> {
  constructor(private readonly attributeName: string) {}

  name(): string {
    return this.attributeName;
  }

  /** 解析输入文本（参数格式校验），不检查约束。 */
  abstract parse(token: string): T;

  /** 检查值是否满足本属性的约束（业务校验）；默认无约束。 */
  check(_value: T): void {}

  /** 输出文本。 */
  abstract format(value: T): string;
}
