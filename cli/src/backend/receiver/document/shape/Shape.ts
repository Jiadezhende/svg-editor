import type Attribute from './attribute/Attribute';
import StringAttribute from './attribute/StringAttribute';
import StrokeWidthAttribute from './attribute/StrokeWidthAttribute';
import EditorError from '../../../error/EditorError';
import ShapeMemento from './ShapeMemento';
import type ShapeView from './ShapeView';
import type { SvgElement } from './SvgElement';

/** 解析后的领域模型；parts 是消费的私有部件，children 只列出仍应成为文档子节点的输入 Shape。 */
export interface ShapeParseResult {
  readonly shape: Shape;
  readonly parts: readonly Shape[];
  readonly children: readonly Shape[];
}

/**
 * 单个图形的领域模型；不保存文档树关系。
 *
 * 静态成员即定义：子类覆盖 `type`（类型名）、`params`（必填属性模板，默认也作为创建参数）、
 * `paint`（create 的可选外观参数名）、`anchor`（move 回显使用的 x、y 属性名）、
 * `content`（在 SVG 中写成子文本而非元素属性的那个属性名）；`element()` 默认返回 `type`，
 * 复合模型可覆写为实际写出的底层 SVG 标签（如 Box 的 `g`）。
 * 外观属性 fill / stroke / stroke-width 由本类统一声明，复合模型可以覆写属性表选择不合并。
 *
 * 读入由静态 `parse` 多态构造，写出由实例方法 `toSvg` 多态生成；两者都只描述模型自身的组成，
 * 外部 XML 与文档节点树的递归分别由 SvgReader / SvgWriter 负责。
 *
 * 实例按模板持有全部属性对象（未赋值时 value 为 null），构造只建立结构；
 * 必填、跨属性与部件结构约束由 validate() 检查，Receiver 的创建与设置入口负责调用。
 * 不变量：id 符合合法字符规则，属性值满足其具体种类的约束。
 */
export default abstract class Shape {
  // ── 类型定义与注册契约（静态成员） ──

  static readonly type: string = '';
  static readonly params: readonly Attribute[] = [];
  static readonly createParams: readonly Attribute[] | null = null;
  static readonly paint: string | null = null;
  static readonly anchor: readonly [string, string] | null = null;
  static readonly content: string | null = null;

  private static readonly appearance: readonly Attribute[] = [
    new StringAttribute('fill'),
    new StringAttribute('stroke'),
    new StrokeWidthAttribute('stroke-width'),
  ];

  private static readonly idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  /** 本类的属性表：必填参数在前，外观属性在后；复合模型可覆写以不合并外观。 */
  static attributes(): readonly Attribute[] {
    return [...this.params, ...Shape.appearance];
  }

  /** 按名字查属性表，没有该属性时返回 null。 */
  static attribute(name: string): Attribute | null {
    return this.attributes().find((attribute) => attribute.name() === name) ?? null;
  }

  /** 通用数据构造；子类型可消费部件并返回 parts 与剩余文档成员，不接触 XML 或节点。 */
  static parse(
    id: string,
    attributes: ReadonlyMap<string, string>,
    readChildren: () => readonly Shape[] = () => [],
  ): ShapeParseResult {
    const Model = this as unknown as new (id: string, values?: ReadonlyMap<string, number | string>) => Shape;
    const shape = new Model(id, this.parseValues(attributes));
    shape.validate();
    return { shape, parts: [], children: shape.acceptsChildren() ? readChildren() : [] };
  }

  /** 复用属性模板解析文本；持久化缺失的必填值沿用模板默认值，未声明的输入被忽略。 */
  protected static parseValues(attributes: ReadonlyMap<string, string>): Map<string, number | string> {
    const values = new Map<string, number | string>();
    for (const attribute of this.attributes()) {
      const raw = attributes.get(attribute.name());
      if (raw !== undefined) {
        values.set(attribute.name(), attribute.withToken(raw).value as number | string);
      } else if (this.params.includes(attribute)) {
        values.set(attribute.name(), attribute.defaultValue());
      }
    }
    return values;
  }

  /** 领域 id 约束，同样用于持久化元素校验。 */
  static checkId(id: string): void {
    if (!Shape.idPattern.test(id)) throw new EditorError(`invalid id: ${id}`);
  }

  // ── 实例状态与构造 ──

  private readonly shapeId: string;
  private readonly attributesByName: Map<string, Attribute>;

  /**
   * 绑定并校验 id，按类级模板建立全部属性条目。
   * `values` 只用于恢复和复合模型初始化，创建路径不传；必填完整性由 `validate()` 检查。
   */
  constructor(
    id: string,
    values: ReadonlyMap<string, number | string> = new Map(),
  ) {
    Shape.checkId(id);
    this.shapeId = id;
    this.attributesByName = Shape.buildAttributes(this.definition());
    for (const [name, value] of values) {
      this.assign(name, value);
    }
  }

  // ── 实例标识与属性读取 ──

  id(): string {
    return this.shapeId;
  }

  /** 自身及私有部件占用的 id；默认由 parts() 汇总，特殊模型可覆写。 */
  identifiers(): readonly string[] {
    return [this.shapeId, ...this.parts().flatMap((part) => part.identifiers())];
  }

  type(): string {
    return this.definition().type;
  }

  /** 命令回显使用的模型身份：`<type>#<id>`。 */
  modelLabel(): string {
    return `${this.type()}#${this.shapeId}`;
  }

  /**
   * 图形写到 SVG 时使用的底层标签名，例如 rect、circle、g。
   * 默认与 `type` 相同；复合模型可覆写为实际写出的容器标签（如 Box 的 `g`）。
   */
  element(): string {
    return this.type();
  }

  /** tree / show 使用的文件身份：`<element>#<id>`。 */
  fileLabel(): string {
    return `${this.element()}#${this.shapeId}`;
  }

  /** 属性的原值；未设置（或不在属性表中）时为 null。 */
  value(name: string): number | string | null {
    return this.attributesByName.get(name)?.value ?? null;
  }

  /** 数值属性的原值；未设置或不是数值时报错。供模型自身计算使用。 */
  protected number(name: string): number {
    const value = this.value(name);
    if (typeof value !== 'number') {
      throw new EditorError(`${name} must be a number`);
    }
    return value;
  }

  /** 已设置属性的原值，按属性表顺序，`content` 属性除外（供写出元素属性）。 */
  entries(): ReadonlyArray<readonly [string, number | string]> {
    const content = this.definition().content;
    return this.definition()
      .attributes()
      .flatMap((attribute) => {
        const value = this.attributesByName.get(attribute.name())?.value ?? null;
        return value === null || attribute.name() === content ? [] : [[attribute.name(), value] as const];
      });
  }

  /** `content` 属性的原值；本类没有 `content` 时为 null（供写出子文本）。 */
  content(): number | string | null {
    const content = this.definition().content;
    return content === null ? null : this.value(content);
  }

  /**
   * 自身及私有部件的 SVG 元素描述；文档成员由 Writer 追加。
   * 默认实现通过多态 `parts()` 递归，复合模型无需重复写出自身属性。
   */
  toSvg(): SvgElement {
    const kind = this.element() === this.type() ? [] : [['data-kind', this.type()] as const];
    return {
      type: this.element(),
      attributes: [['id', this.id()], ...kind, ...this.entries()],
      content: this.content(),
      children: this.parts().map((part) => part.toSvg()),
    };
  }

  // ── 实例展示 ──

  /** tree 的内联属性：核心属性（`params`）依次 `名=值`；没有核心属性时为空串。 */
  summary(): string {
    return this.joined(this.definition().params);
  }

  view(): ShapeView {
    return Object.freeze({
      id: this.id(),
      type: this.type(),
      label: this.fileLabel(),
      summary: this.summary(),
      container: this.acceptsChildren(),
      attributes: Object.freeze(this.entries().map(([name, value]) => Object.freeze([name, value] as const))),
      content: this.content(),
      details: Object.freeze([...this.details()]),
      children: Object.freeze([...this.viewParts()]),
    });
  }

  /** show 的自身属性行：核心属性行；设置了外观属性时再加一行外观属性。 */
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
    return this.attributesByName.get(name)?.display() ?? null;
  }

  // ── 属性修改、校验与快照 ──

  /** 设置属性：不在本类属性表中时报错；解析与约束校验失败时属性不变。 */
  set(name: string, token: string): void {
    const attribute = this.attributesByName.get(name);
    if (attribute === undefined) {
      throw new EditorError(`unknown attribute: ${name}`);
    }
    this.attributesByName.set(name, attribute.withToken(token));
  }

  /** 整图校验：必填属性齐全；子类可覆写并调用 `super.validate()` 检查部件结构。 */
  validate(): void {
    for (const attribute of this.definition().params) {
      if (this.attributesByName.get(attribute.name())?.value == null) {
        throw new EditorError(`missing attribute: ${attribute.name()}`);
      }
    }
  }

  /** 平移自身；具体模型实现参与平移的属性。违规值由属性规则拒绝。 */
  abstract move(dx: number, dy: number): void;

  /** 以坐标原点为中心缩放自身；具体模型实现参与缩放的属性。 */
  abstract scale(factor: number): void;

  /** 自身属性快照；复合模型可扩展其内部部件快照。 */
  capture(): ShapeMemento {
    const saved = new Map(this.attributesByName);
    return new ShapeMemento([
      () => {
        this.attributesByName.clear();
        for (const [name, attribute] of saved) {
          this.attributesByName.set(name, attribute);
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

  checkUngroup(): void {
    if (!this.acceptsChildren()) throw new EditorError(`not a container: ${this.id()}`);
  }

  // ── 子类扩展与内部辅助 ──

  /** 写入已解析的值：按属性规则校验后替换，不经过文本解析。供模型计算与恢复使用。 */
  assign(name: string, value: number | string): void {
    const attribute = this.attributesByName.get(name);
    if (attribute === undefined) {
      throw new Error(`${this.type()} has no attribute ${name}`);
    }
    this.attributesByName.set(name, attribute.withValue(value));
  }

  /** show 的核心属性行，默认与 tree 的内联属性相同。 */
  protected coreDetail(): string {
    return this.summary();
  }

  /** 自身持有的私有部件；不包含文档成员。复合模型覆写。 */
  protected parts(): readonly Shape[] { return []; }

  /** 展示层可选提供的私有部件视图；默认不展示，复合模型按需覆写。 */
  protected viewParts(): readonly ShapeView[] { return []; }

  /** 本实例所属图形类的静态定义。 */
  protected definition(): typeof Shape {
    return this.constructor as typeof Shape;
  }

  /** 按类级模板建立实例属性表；重复属性在建立前发现。 */
  private static buildAttributes(definition: typeof Shape): Map<string, Attribute> {
    const attributes = new Map<string, Attribute>();
    for (const attribute of definition.attributes()) {
      if (attributes.has(attribute.name())) {
        throw new Error(`duplicate attribute: ${attribute.name()}`);
      }
      attributes.set(attribute.name(), attribute);
    }
    return attributes;
  }

  /** attributes 中已设置的值，以 `名=展示值` 用空格连接。 */
  private joined(attributes: readonly Attribute[]): string {
    return attributes
      .flatMap((attribute) => {
        const text = this.attributesByName.get(attribute.name())?.display() ?? null;
        return text === null ? [] : [`${attribute.name()}=${text}`];
      })
      .join(' ');
  }
}
