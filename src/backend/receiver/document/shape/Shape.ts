import type AttributeSpec from '../attribute/AttributeSpec';
import type { AttributeValue } from '../attribute/AttributeSpec';
import StringSpec from '../attribute/StringSpec';
import StrokeWidthSpec from '../attribute/StrokeWidthSpec';
import EditorError from '../../../error/EditorError';
import ShapeMemento from './ShapeMemento';

/** 解析后的领域模型；children 只列出仍应成为文档子节点的输入 Shape。 */
export interface ShapeParseResult {
  readonly shape: Shape;
  readonly children: readonly Shape[];
}

/**
 * 单个图形的领域模型；不保存文档树关系。
 *
 * 静态成员即定义：子类覆盖 `type`（类型名）、`params`（create 必填参数表，顺序即参数顺序）、
 * `paint`（create 的可选外观参数名）、`anchor`（move 回显的锚点：x 轴与 y 轴坐标属性名，注册时校验）、
 * `content`（在 SVG 中写成子文本而非元素属性的那个属性名）；
 * 外观属性 fill / stroke / stroke-width 由本类统一声明。
 * 不变量：id 符合合法字符规则，各属性值满足其属性种类的约束；校验失败时不产生图形。
 */
export default abstract class Shape {
  // ── 类型定义与注册契约（静态成员） ──

  static readonly type: string = '';
  static readonly params: readonly AttributeSpec[] = [];
  static readonly paint: string | null = null;
  static readonly anchor: readonly [string, string] | null = null;
  static readonly content: string | null = null;

  private static readonly appearance: readonly AttributeSpec[] = [
    new StringSpec('fill'),
    new StringSpec('stroke'),
    new StrokeWidthSpec('stroke-width'),
  ];

  private static readonly idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  /** 本类的属性表：create 必填参数在前，外观属性在后。 */
  static attributes(): readonly AttributeSpec[] {
    return [...this.params, ...Shape.appearance];
  }

  /** 按名字查属性表，没有该属性时返回 null。 */
  static attribute(name: string): AttributeSpec | null {
    return this.attributes().find((spec) => spec.name() === name) ?? null;
  }

  /** 通用数据构造；子类型可消费部件并返回剩余文档成员，不接触 XML 或节点。 */
  static parse(
    id: string,
    attributes: ReadonlyMap<string, string>,
    readChildren: () => readonly Shape[] = () => [],
  ): ShapeParseResult {
    const Model = this as unknown as new (id: string, values: ReadonlyMap<string, AttributeValue>) => Shape;
    const shape = new Model(id, this.parseValues(attributes));
    return { shape, children: shape.acceptsChildren() ? readChildren() : [] };
  }

  /** 复用属性规格解析文本；持久化缺失的必填值沿用规格默认值。 */
  protected static parseValues(attributes: ReadonlyMap<string, string>): Map<string, AttributeValue> {
    const values = new Map<string, AttributeValue>();
    for (const spec of this.attributes()) {
      const raw = attributes.get(spec.name());
      if (raw !== undefined) values.set(spec.name(), spec.parse(raw));
      else if (this.params.includes(spec)) values.set(spec.name(), spec.defaultValue());
    }
    return values;
  }

  /** 领域 id 约束，同样用于持久化元素校验。 */
  static checkId(id: string): void {
    if (!Shape.idPattern.test(id)) throw new EditorError(`invalid id: ${id}`);
  }

  // ── 实例状态与构造 ──

  private readonly shapeId: string;
  private readonly values: Map<string, AttributeValue>;

  /** values 中的属性须在本类的属性表内（否则属于程序缺陷），未给出的外观属性视为未设置。 */
  constructor(
    id: string,
    values: ReadonlyMap<string, AttributeValue> = new Map(),
  ) {
    Shape.checkId(id);
    for (const [name, value] of values) {
      const spec = this.definition().attribute(name);
      if (spec === null) {
        throw new Error(`${this.type()} has no attribute ${name}`);
      }
      spec.check(value);
    }
    for (const spec of this.definition().params) {
      if (!values.has(spec.name())) {
        throw new EditorError(`missing attribute: ${spec.name()}`);
      }
    }
    this.shapeId = id;
    this.values = new Map(values);
  }

  // ── 实例标识与属性读取 ──

  id(): string {
    return this.shapeId;
  }

  /** 自身及私有部件占用的 id；复合模型覆写，不暴露部件或文档关系。 */
  identifiers(): readonly string[] {
    return [this.shapeId];
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

  /** 已设置属性的原值，按属性表顺序，`content` 属性除外（供写出元素属性）。 */
  entries(): ReadonlyArray<readonly [string, AttributeValue]> {
    const content = this.definition().content;
    return this.definition()
      .attributes()
      .flatMap((spec) => {
        const value = this.values.get(spec.name());
        return value === undefined || spec.name() === content ? [] : [[spec.name(), value] as const];
      });
  }

  /** `content` 属性的原值；本类没有 `content` 时为 null（供写出子文本）。 */
  content(): AttributeValue | null {
    const content = this.definition().content;
    return content === null ? null : this.value(content);
  }

  // ── 实例展示 ──

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

  // ── 属性修改与快照 ──

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

  /** 平移自身属性；具体复合模型自行组织内部部件。 */
  move(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new EditorError('move offsets must be finite');
    }
    this.transformAtomically(() => {
      this.transform((spec, value) => spec.translate(value, dx, dy));
    });
  }

  /** 以坐标原点为中心缩放自身属性。 */
  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new EditorError('scale factor must be positive');
    }
    this.transformAtomically(() => {
      this.transform((spec, value) => spec.scale(value, factor));
    });
  }

  /** 自身属性快照；复合模型可扩展其内部部件快照。 */
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

  /** 是否允许文档节点接收成员；只声明能力，不保存或修改节点关系。 */
  acceptsChildren(): boolean {
    return false;
  }

  checkInsert(_shape: Shape): void {
    if (!this.acceptsChildren()) throw new EditorError(`not a container: ${this.id()}`);
  }

  checkRemove(shape: Shape): void {
    if (!this.acceptsChildren()) throw new EditorError(`cannot remove internal part: ${shape.id()}`);
  }

  private transformAtomically(change: () => void): void {
    const before = this.capture();
    try {
      change();
    } catch (error) {
      before.restore();
      throw error;
    }
  }

  // ── 子类扩展与内部辅助 ──

  /** show 的核心属性行，默认与 tree 的内联属性相同。 */
  protected coreDetail(): string {
    return this.summary();
  }

  /** 本实例所属图形类的静态定义。 */
  protected definition(): typeof Shape {
    return this.constructor as typeof Shape;
  }

  private transform(change: (spec: AttributeSpec, value: AttributeValue) => AttributeValue): void {
    const next = new Map(this.values);
    for (const spec of this.definition().attributes()) {
      const value = this.values.get(spec.name());
      if (value !== undefined) {
        const updated = change(spec, value);
        spec.check(updated);
        next.set(spec.name(), updated);
      }
    }
    for (const [name, value] of next) this.values.set(name, value);
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
