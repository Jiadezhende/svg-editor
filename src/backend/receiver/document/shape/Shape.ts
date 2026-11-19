import type AttributeSpec from '../attribute/AttributeSpec';
import type { AttributeValue } from '../attribute/AttributeSpec';
import StringSpec from '../attribute/StringSpec';
import StrokeWidthSpec from '../attribute/StrokeWidthSpec';
import EditorError from '../../../error/EditorError';
import ShapeMemento from './ShapeMemento';
import { isEditing, ownerOf } from '../StructureEdit';

/**
 * Composite 中的 Component：容器与叶子图形的共同抽象。
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

  // ── 实例状态与构造 ──

  private readonly shapeId: string;
  private readonly values: Map<string, AttributeValue>;
  private parentShape: Shape | null = null;
  private readonly members: Shape[] | null;

  /** values 中的属性须在本类的属性表内（否则属于程序缺陷），未给出的外观属性视为未设置。 */
  constructor(
    id: string,
    values: ReadonlyMap<string, AttributeValue> = new Map(),
    children: readonly Shape[] | null = null,
  ) {
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
    for (const spec of this.definition().params) {
      if (!values.has(spec.name())) {
        throw new EditorError(`missing attribute: ${spec.name()}`);
      }
    }
    this.shapeId = id;
    this.values = new Map(values);
    this.members = children === null ? null : [];
    for (const child of children ?? []) this.insertChild(child);
  }

  // ── 实例标识与属性读取 ──

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

  /** 平移自身属性及子树；失败恢复整棵子树。 */
  move(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new EditorError('move offsets must be finite');
    }
    this.transformTree(() => {
      this.transform((spec, value) => spec.translate(value, dx, dy));
      for (const child of this.children()) child.move(dx, dy);
    });
  }

  /** 以坐标原点为中心缩放自身及子树；失败恢复整棵子树。 */
  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new EditorError('scale factor must be positive');
    }
    this.transformTree(() => {
      this.transform((spec, value) => spec.scale(value, factor));
      for (const child of this.children()) child.scale(factor);
    });
  }

  /** 自身及子树的属性快照，不包含结构变更。 */
  capture(): ShapeMemento {
    const saved = new Map(this.values);
    return new ShapeMemento([
      () => {
        this.values.clear();
        for (const [name, value] of saved) {
          this.values.set(name, value);
        }
      },
    ]).with(this.children().map((child) => child.capture()));
  }

  // ── 树结构与查找 ──

  /** 必须存在的父 Shape；顶层图形和脱离树的根均无父 Shape。 */
  requireParent(): Shape {
    if (this.parentShape === null) {
      throw new Error(`${this.label()} is not attached`);
    }
    return this.parentShape;
  }

  /** 顶层图形与脱离树的根为 null；文档归属单独维护。 */
  parent(): Shape | null {
    return this.parentShape;
  }

  /** 已入文档的树只能由文档结构入口修改；脱离文档的子树可自行构建。 */
  checkStructureEdit(): void {
    let node: Shape = this;
    while (node.parentShape !== null) node = node.parentShape;
    const owner = ownerOf(node);
    if (owner !== null && !isEditing(owner)) {
      throw new EditorError('use Document to modify an attached tree');
    }
  }

  /** 移到 parent 的 index 处（省略时追加到末尾）；已在某个父节点中时先摘下。 */
  relocate(parent: Shape, index?: number): void {
    this.checkStructureEdit();
    parent.checkStructureEdit();
    parent.checkInsert(this);
    this.parentShape?.checkRemove(this);
    const length = parent.children().length - (this.parentShape === parent ? 1 : 0);
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index > length)) {
      throw new Error(`invalid child index: ${index}`);
    }
    if (this.parentShape !== null) {
      this.parentShape.remove(this);
    }
    parent.insert(this, index);
  }

  /** 由模型结构方法在插入时调用。 */
  attachTo(container: Shape): void {
    if (this.parentShape !== null || ownerOf(this) !== null) {
      throw new Error(`${this.label()} is already attached`);
    }
    container.checkStructureEdit();
    this.parentShape = container;
  }

  /** 由模型结构方法在摘除时调用。 */
  detach(): void {
    this.checkStructureEdit();
    this.parentShape = null;
  }

  /** 内部组成，按绘制顺序返回副本；不代表允许外部增删。 */
  children(): readonly Shape[] {
    return this.members === null ? [] : [...this.members];
  }

  find(id: string): Shape | null {
    if (id === this.shapeId) return this;
    for (const child of this.members ?? []) {
      const found = child.find(id);
      if (found !== null) return found;
    }
    return null;
  }

  /** 是否开放外部成员接入；具体模型声明自己的能力。 */
  acceptsChildren(): boolean {
    return this.members !== null;
  }

  checkInsert(shape: Shape): void {
    if (!this.acceptsChildren()) throw new EditorError(`not a container: ${this.id()}`);
    this.checkChildCycle(shape);
  }

  checkRemove(shape: Shape): void {
    if (!this.acceptsChildren()) throw new EditorError(`cannot remove internal part: ${shape.id()}`);
  }

  /** 外部成员编辑仍受模型规则和文档结构作用域约束。 */
  insert(shape: Shape, index?: number): void {
    this.checkInsert(shape);
    this.insertChild(shape, index);
  }

  remove(shape: Shape): number {
    this.checkRemove(shape);
    return this.removeChild(shape);
  }

  /** 供具体模型构建、维护自身部件，不开放任意外部成员。 */
  protected insertChild(shape: Shape, index?: number): void {
    this.checkStructureEdit();
    const members = this.members;
    if (members === null) throw new EditorError(`not a container: ${this.id()}`);
    const position = index ?? members.length;
    if (!Number.isInteger(position) || position < 0 || position > members.length) {
      throw new EditorError(`invalid child index: ${position}`);
    }
    this.checkChildCycle(shape);
    shape.attachTo(this);
    members.splice(position, 0, shape);
  }

  protected removeChild(shape: Shape): number {
    this.checkStructureEdit();
    const index = this.members?.indexOf(shape) ?? -1;
    if (index < 0 || this.members === null) {
      throw new Error(`${shape.label()} is not a child of ${this.label()}`);
    }
    shape.detach();
    this.members.splice(index, 1);
    return index;
  }

  private checkChildCycle(shape: Shape): void {
    const contains = (node: Shape): boolean => node === this || node.children().some(contains);
    if (contains(shape)) {
      throw new EditorError(`cannot add a container into itself or its descendant: ${shape.id()}`);
    }
  }

  private transformTree(change: () => void): void {
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
