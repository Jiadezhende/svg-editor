/** 属性值：数值属性为 number，其余为原样保存的 string。 */
export type AttributeValue = number | string;

/** 坐标所在的轴，平移按轴进行。 */
export type Axis = 'x' | 'y';

/**
 * 属性种类：一个属性的值如何解析、须满足什么约束、如何展示、在平移与缩放下如何变化。
 * 只负责规则，不持有值；取原值经 Shape.value(name)。
 * 按"值在各通用操作下的行为"划分子类；各图形类以静态属性表声明自己有哪些属性、各属哪一种类。
 */
export default abstract class AttributeSpec<T extends AttributeValue = AttributeValue> {
  constructor(private readonly attributeName: string) {}

  name(): string {
    return this.attributeName;
  }

  /** 坐标所在的轴；不是坐标时为 null。 */
  axis(): Axis | null {
    return null;
  }

  /** 解析输入文本（参数格式校验），不检查约束。 */
  abstract parse(token: string): T;

  /** 检查值是否满足本属性的约束（业务校验）；默认无约束。 */
  check(_value: T): void {}

  /** 展示用文本（tree / show）。 */
  abstract display(value: T): string;

  /** 平移后的值；默认不变。 */
  translate(value: T, _dx: number, _dy: number): T {
    return value;
  }

  /** 以坐标原点为中心缩放后的值；默认不变。 */
  scale(value: T, _factor: number): T {
    return value;
  }
}
