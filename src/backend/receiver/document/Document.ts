import EditorError from '../../error/EditorError';
import Shape from './shape/Shape';
import { editStructure, ownerOf, bindRoot, unbindRoot } from './StructureEdit';

/** viewBox 的四个分量：min-x、min-y、width、height。 */
export type ViewBox = readonly [number, number, number, number];

/**
 * 当前文档，即画布根 `svg`：画布尺寸、viewBox 与顶层图形；顶层图形的 parent 为 null，文档归属独立维护。
 * 不变量：画布宽高须为正数；id 全文档唯一。校验失败时状态不变。
 */
export default class Document {
  private canvasWidth: number;
  private canvasHeight: number;
  private readonly canvasViewBox: ViewBox;
  private readonly roots: Shape[] = [];

  /** 新建文档，viewBox 为 `0 0 w h`。 */
  /** viewBox 省略时为 `0 0 w h`（read 可指定文件中的 viewBox）。 */
  constructor(width: number, height: number, viewBox?: ViewBox) {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
    if (viewBox && (!viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0)) {
      throw new EditorError('invalid viewBox');
    }
    this.canvasViewBox = viewBox ? [...viewBox] : [0, 0, width, height];
  }

  width(): number {
    return this.canvasWidth;
  }

  height(): number {
    return this.canvasHeight;
  }

  viewBox(): ViewBox {
    return [...this.canvasViewBox];
  }

  /** 修改画布尺寸，不改动 viewBox。 */
  resize(width: number, height: number): void {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  label(): string {
    return 'svg';
  }

  children(): readonly Shape[] {
    return [...this.roots];
  }

  insert(shape: Shape, index?: number): void {
    this.add(shape, null, index);
  }

  remove(shape: Shape): number {
    this.checkRemove(shape);
    const parent = shape.parent();
    return editStructure(this, () => {
      if (parent === null) {
        const index = this.roots.indexOf(shape);
        if (index < 0) throw new Error(`${shape.label()} is not a child of svg`);
        unbindRoot(shape, this);
        this.roots.splice(index, 1);
        return index;
      }
      return parent.remove(shape);
    });
  }

  /** 全部图形，按先序遍历（即绘制顺序）。 */
  shapes(): Shape[] {
    const result: Shape[] = [];
    const visit = (children: readonly Shape[]): void => {
      for (const shape of children) {
        result.push(shape);
        visit(shape.children());
      }
    };
    visit(this.children());
    return result;
  }

  /** 在整棵图形树中按 id 查找。 */
  find(id: string): Shape | null {
    for (const shape of this.roots) {
      const found = shape.find(id);
      if (found !== null) return found;
    }
    return null;
  }

  /** 按 id 取图形，不存在时报错。 */
  requireShape(id: string): Shape {
    const shape = this.find(id);
    if (shape === null) {
      throw new EditorError(`no such shape: ${id}`);
    }
    return shape;
  }

  /** 按 id 取得允许接收外部成员的 Shape，保持既有 CLI 错误语义。 */
  requireChildTarget(id: string): Shape {
    const shape = this.find(id);
    if (shape === null) {
      throw new EditorError(`no such container: ${id}`);
    }
    if (!shape.acceptsChildren()) throw new EditorError(`not a container: ${id}`);
    return shape;
  }

  /** 只校验完整候选子树与目标，null 表示顶层，不修改文档。 */
  checkAdd(shape: Shape, parent: Shape | null = null, index?: number): void {
    this.checkParent(parent);
    if (shape.parent() !== null || ownerOf(shape) !== null) {
      throw new EditorError(`shape already attached: ${shape.id()}`);
    }
    const ids = new Set(this.shapes().map((node) => node.id()));
    const visit = (node: Shape): void => {
      if (ids.has(node.id())) throw new EditorError(`id already exists: ${node.id()}`);
      ids.add(node.id());
      for (const child of node.children()) visit(child);
    };
    visit(shape);
    parent?.checkInsert(shape);
    this.checkIndex(parent, index);
  }

  add(shape: Shape, parent: Shape | null = null, index?: number): void {
    this.checkAdd(shape, parent, index);
    editStructure(this, () => this.insertInto(shape, parent, index));
  }

  relocate(shape: Shape, parent: Shape | null, index?: number): void {
    this.checkRelocate(shape, parent, index);
    editStructure(this, () => {
      this.remove(shape);
      this.insertInto(shape, parent, index);
    });
  }

  /** 供多步骤命令在提交前校验全部源节点。 */
  checkRemove(shape: Shape): void {
    this.requireMember(shape);
    const parent = shape.parent();
    parent?.checkRemove(shape);
  }

  private insertInto(shape: Shape, parent: Shape | null, index?: number): void {
    if (parent === null) {
      bindRoot(shape, this);
      this.roots.splice(index ?? this.roots.length, 0, shape);
    }
    else parent.insert(shape, index);
  }

  private requireMember(shape: Shape): void {
    if (this.find(shape.id()) !== shape) throw new EditorError(`shape is not in document: ${shape.id()}`);
  }

  private checkParent(parent: Shape | null): void {
    if (parent !== null && !this.shapes().some((shape) => shape === parent)) {
      throw new EditorError(`container is not in document: ${parent.label()}`);
    }
  }

  private checkIndex(parent: Shape | null, index?: number, moving?: Shape): void {
    const length = (parent?.children() ?? this.children()).length - (moving?.parent() === parent ? 1 : 0);
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index > length)) {
      throw new EditorError(`invalid child index: ${index}`);
    }
  }

  checkRelocate(shape: Shape, parent: Shape | null, index?: number): void {
    this.requireMember(shape);
    this.checkParent(parent);
    if (shape === parent || this.descendants(shape).some((node) => node === parent)) {
      throw new EditorError(`cannot add a container into itself or its descendant: ${shape.id()}`);
    }
    this.checkIndex(parent, index, shape);
    this.checkRemove(shape);
    parent?.checkInsert(shape);
  }

  private descendants(shape: Shape): Shape[] {
    return shape.children().flatMap((child) => [child, ...this.descendants(child)]);
  }

  private static checkSize(width: number, height: number): void {
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
      throw new EditorError('canvas size must be positive');
    }
  }
}
