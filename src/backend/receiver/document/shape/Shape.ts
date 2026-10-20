import type AttributeSpec from '../attribute/AttributeSpec';
import type { AttributeValue } from '../attribute/AttributeSpec';
import StringSpec from '../attribute/StringSpec';
import StrokeWidthSpec from '../attribute/StrokeWidthSpec';
import type Container from '../Container';
import EditorError from '../../../error/EditorError';

/**
 * Composite 中的 Component：容器与叶子图形的共同抽象。
 *
 * 静态成员即定义：子类覆盖 `type`（类型名）、`params`（create 必填参数表，顺序即参数顺序）、
 * `paint`（create 的可选外观参数名）；外观属性 fill / stroke / stroke-width 由本类统一声明。
 * 不变量：id 符合合法字符规则，各属性值满足其属性种类的约束；校验失败时不产生图形。
 */
export default abstract class Shape {
  static readonly type: string = '';
  static readonly params: readonly AttributeSpec[] = [];
  static readonly paint: string | null = null;

  private static readonly appearance: readonly AttributeSpec[] = [
    new StringSpec('fill'),
    new StringSpec('stroke'),
    new StrokeWidthSpec('stroke-width'),
  ];

  private static readonly idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  private readonly shapeId: string;
  private readonly values: Map<string, AttributeValue>;
  private container: Container | null = null;

  /** 本类的属性表：create 必填参数在前，外观属性在后。 */
  static attributes(): readonly AttributeSpec[] {
    return [...this.params, ...Shape.appearance];
  }

  /** 按名字查属性表，没有该属性时返回 null。 */
  static attribute(name: string): AttributeSpec | null {
    return this.attributes().find((spec) => spec.name() === name) ?? null;
  }

  /** values 中的属性须在本类的属性表内（否则属于程序缺陷），未给出的外观属性视为未设置。 */
  constructor(id: string, values: ReadonlyMap<string, AttributeValue> = new Map()) {
    if (!Shape.idPattern.test(id)) {
      throw new EditorError(`invalid id: ${id}`);
    }
    for (const [name, value] of values) {
      const spec = this.definition().attribute(name);
      if (spec === null) {
        throw new Error(`${this.type()} has no attribute ${name}`);
      }
      spec.check(value);
    }
    this.shapeId = id;
    this.values = new Map(values);
  }

  id(): string {
    return this.shapeId;
  }

  type(): string {
    return this.definition().type;
  }

  /** 回显用的名字：`<type>#<id>`。 */
  label(): string {
    return `${this.type()}#${this.shapeId}`;
  }

  /** tree 的内联属性：核心属性（`params`）依次 `名=值`；没有核心属性时为空串。 */
  summary(): string {
    return this.joined(this.definition().params);
  }

  /** show 的属性行：核心属性行；设置了外观属性时再加一行外观属性。 */
  details(): string[] {
    const appearance = this.joined(Shape.appearance);
    return appearance === '' ? [this.coreDetail()] : [this.coreDetail(), appearance];
  }

  /** 父节点；只对已加入文档的图形调用。 */
  parent(): Container {
    if (this.container === null) {
      throw new Error(`${this.label()} is not attached`);
    }
    return this.container;
  }

  /** 由 ChildList 在插入时调用。 */
  attachTo(container: Container): void {
    if (this.container !== null) {
      throw new Error(`${this.label()} is already attached to ${this.container.label()}`);
    }
    this.container = container;
  }

  /** 由 ChildList 在摘除时调用。 */
  detach(): void {
    this.container = null;
  }

  /** 在以本图形为根的子树中按 id 查找；叶子只比对自身。 */
  find(id: string): Shape | null {
    return id === this.shapeId ? this : null;
  }

  /** 作为容器的视图；叶子不是容器，返回 null。 */
  asContainer(): Container | null {
    return null;
  }

  /** show 的核心属性行，默认与 tree 的内联属性相同。 */
  protected coreDetail(): string {
    return this.summary();
  }

  /** 本实例所属图形类的静态定义。 */
  protected definition(): typeof Shape {
    return this.constructor as typeof Shape;
  }

  /** specs 中已设置的属性，以 `名=值` 用空格连接。 */
  private joined(specs: readonly AttributeSpec[]): string {
    return specs
      .flatMap((spec) => {
        const value = this.values.get(spec.name());
        return value === undefined ? [] : [`${spec.name()}=${spec.format(value)}`];
      })
      .join(' ');
  }
}
