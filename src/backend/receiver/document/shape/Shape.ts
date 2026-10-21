import type AttributeSpec from '../attribute/AttributeSpec';
import type { AttributeValue } from '../attribute/AttributeSpec';
import StringSpec from '../attribute/StringSpec';
import StrokeWidthSpec from '../attribute/StrokeWidthSpec';
import type Container from '../Container';
import EditorError from '../../../error/EditorError';
import ShapeMemento from './ShapeMemento';

/**
 * Composite 中的 Component：容器与叶子图形的共同抽象。
 *
 * 静态成员即定义：子类覆盖 `type`（类型名）、`params`（create 必填参数表，顺序即参数顺序）、
 * `paint`（create 的可选外观参数名）、`anchor`（move 回显的锚点：x 轴与 y 轴坐标属性名，注册时校验）；
 * 外观属性 fill / stroke / stroke-width 由本类统一声明。
 * 不变量：id 符合合法字符规则，各属性值满足其属性种类的约束；校验失败时不产生图形。
 */
export default abstract class Shape {
  static readonly type: string = '';
  static readonly params: readonly AttributeSpec[] = [];
  static readonly paint: string | null = null;
  static readonly anchor: readonly [string, string] | null = null;

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

  /** 属性的原值；未设置（或不在属性表中）时为 null。 */
  value(name: string): AttributeValue | null {
    return this.values.get(name) ?? null;
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

  /** 锚点坐标的展示文本 [x, y]；没有锚点（如容器）时为 null。 */
  position(): readonly [string, string] | null {
    const anchor = this.definition().anchor;
    if (anchor === null) {
      return null;
    }
    const [x, y] = anchor.map((name) => this.display(name) ?? '');
    return [x, y];
  }

  /** 属性值的展示文本；未设置时为 null。 */
  display(name: string): string | null {
    const spec = this.definition().attribute(name);
    const value = this.values.get(name);
    return spec === null || value === undefined ? null : spec.display(value);
  }

  /** 设置属性：不在本类属性表中时报错；解析与约束校验失败时属性不变。 */
  set(name: string, token: string): void {
    const spec = this.definition().attribute(name);
    if (spec === null) {
      throw new EditorError(`unknown attribute: ${name}`);
    }
    const value = spec.parse(token);
    spec.check(value);
    this.values.set(name, value);
  }

  /** 平移：已设置的属性逐个交给属性种类变换。 */
  move(dx: number, dy: number): void {
    this.transform((spec, value) => spec.translate(value, dx, dy));
  }

  /** 以坐标原点为中心缩放：已设置的属性逐个交给属性种类变换。 */
  scale(factor: number): void {
    this.transform((spec, value) => spec.scale(value, factor));
  }

  /** 当前属性的快照，restore 时写回。 */
  capture(): ShapeMemento {
    const saved = new Map(this.values);
    return new ShapeMemento([
      () => {
        this.values.clear();
        for (const [name, value] of saved) {
          this.values.set(name, value);
        }
      },
    ]);
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

  private transform(change: (spec: AttributeSpec, value: AttributeValue) => AttributeValue): void {
    for (const spec of this.definition().attributes()) {
      const value = this.values.get(spec.name());
      if (value !== undefined) {
        this.values.set(spec.name(), change(spec, value));
      }
    }
  }

  /** specs 中已设置的属性，以 `名=展示值` 用空格连接。 */
  private joined(specs: readonly AttributeSpec[]): string {
    return specs
      .flatMap((spec) => {
        const value = this.values.get(spec.name());
        return value === undefined ? [] : [`${spec.name()}=${spec.display(value)}`];
      })
      .join(' ');
  }
}
