/**
 * 一个属性：持有当前值，并封装该值的解析、校验与展示规则。
 *
 * 实例不可变：`withToken`、`withValue` 都返回同配置的新对象，未赋值（`null`）保持未赋值。
 */
export default abstract class Attribute<T extends number | string = number | string> {
  constructor(
    private readonly attributeName: string,
    readonly value: T | null = null,
  ) {}

  name(): string {
    return this.attributeName;
  }

  /** 解析输入文本，校验后返回新属性。 */
  withToken(token: string): Attribute<T> {
    return this.withValue(this.parse(token));
  }

  /** 校验已有的数字或字符串，返回新属性。 */
  withValue(value: T): Attribute<T> {
    this.validate(value);
    return this.recreate(value);
  }

  /** 文件中缺少该属性时采用的值。 */
  abstract defaultValue(): T;

  /** 展示文本；未设置时为 null。 */
  display(): string | null {
    return this.value === null ? null : this.format(this.value);
  }

  /** 解析输入文本为原值，不检查业务约束。 */
  protected abstract parse(token: string): T;

  /** 检查值是否满足本属性的约束。 */
  protected abstract validate(value: T): void;

  /** 以当前配置和新值生成新属性，保持具体子类与配置。 */
  protected abstract recreate(value: T): Attribute<T>;

  /** 原值的展示文本。 */
  protected abstract format(value: T): string;
}
