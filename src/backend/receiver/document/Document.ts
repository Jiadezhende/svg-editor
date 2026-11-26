import EditorError from '../../error/EditorError';
import Shape from './shape/Shape';
import ShapeMemento from './shape/ShapeMemento';
import ShapeNode from './ShapeNode';
import DocumentStructureMemento from './DocumentStructureMemento';
import type ShapeView from './shape/ShapeView';

/** viewBox 的四个分量：min-x、min-y、width、height。 */
export type ViewBox = readonly [number, number, number, number];

/** 节点关系仅在本模块内写入，外部只能获得副本或只读引用。 */
type NodeState = { parent: ShapeNode | null; children: ShapeNode[] };
const states = new WeakMap<ShapeNode, NodeState>();
const owners = new WeakMap<Shape, Document>();

/** 画布、节点树与全文档约束；不依赖具体图形类。 */
export default class Document {
  private canvasWidth: number;
  private canvasHeight: number;
  private readonly canvasViewBox: ViewBox;
  private readonly roots: ShapeNode[] = [];
  private readonly byId = new Map<string, ShapeNode>();

  constructor(width: number, height: number, viewBox?: ViewBox) {
    Document.checkSize(width, height);
    if (viewBox && (!viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0)) {
      throw new EditorError('invalid viewBox');
    }
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvasViewBox = viewBox ? [...viewBox] : [0, 0, width, height];
  }

  width(): number { return this.canvasWidth; }
  height(): number { return this.canvasHeight; }
  viewBox(): ViewBox { return [...this.canvasViewBox]; }
  label(): string { return 'svg'; }

  resize(width: number, height: number): void {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  children(): readonly ShapeNode[] { return [...this.roots]; }

  indexOf(node: ShapeNode): number {
    this.requireMember(node);
    return this.list(node.parent()).indexOf(node);
  }

  /** 文档或指定节点的先序遍历，包含指定节点本身。 */
  nodes(root?: ShapeNode): ShapeNode[] {
    if (root !== undefined) this.requireMember(root);
    const visit = (node: ShapeNode): ShapeNode[] => [node, ...node.children().flatMap(visit)];
    return (root === undefined ? this.roots : [root]).flatMap(visit);
  }

  /** 按文档顺序提供图形快照，私有部件排在文档成员之前。 */
  shapeViews(root?: ShapeNode): readonly ShapeView[] {
    if (root !== undefined) this.requireMember(root);
    const visit = (node: ShapeNode): ShapeView => {
      const view = node.value.view();
      const children = node.children();
      if (children.length === 0) return view;
      return Object.freeze({ ...view, children: Object.freeze([...view.children, ...children.map(visit)]) });
    };
    return Object.freeze((root === undefined ? this.roots : [root]).map(visit));
  }

  elementCount(): number {
    return this.nodes().reduce((count, node) => count + node.value.identifiers().length, 0);
  }

  findNode(id: string): ShapeNode | null { return this.byId.get(id) ?? null; }

  requireNode(id: string): ShapeNode {
    const node = this.findNode(id);
    if (node === null) throw new EditorError(`no such shape: ${id}`);
    return node;
  }

  private checkInsert(shape: Shape, parent: ShapeNode | null = null, index?: number): void {
    this.checkParent(parent);
    if (owners.has(shape)) throw new EditorError(`shape already attached: ${shape.id()}`);
    if (this.byId.has(shape.id())) throw new EditorError(`id already exists: ${shape.id()}`);
    this.checkIdentifiers([...this.nodes().map((node) => node.value), shape]);
    parent?.value.checkInsert(shape);
    this.checkIndex(parent, index);
  }

  insert(shape: Shape, parent: ShapeNode | null = null, index?: number): ShapeNode {
    this.checkInsert(shape, parent, index);
    const node = new ShapeNode(shape, () => states.get(node)!);
    states.set(node, { parent, children: [] });
    this.list(parent).splice(index ?? this.list(parent).length, 0, node);
    this.byId.set(shape.id(), node);
    owners.set(shape, this);
    return node;
  }

  checkRemove(node: ShapeNode): void {
    this.requireMember(node);
    node.parent()?.value.checkRemove(node.value);
  }

  remove(node: ShapeNode): number {
    this.checkRemove(node);
    const subtree = this.nodes(node);
    const index = this.indexOf(node);
    this.list(node.parent()).splice(index, 1);
    for (const child of subtree) {
      this.byId.delete(child.value.id());
      owners.delete(child.value);
      states.set(child, { parent: null, children: [] });
    }
    return index;
  }

  checkRelocate(node: ShapeNode, parent: ShapeNode | null, index?: number): void {
    this.requireMember(node);
    this.checkParent(parent);
    for (let ancestor = parent; ancestor !== null; ancestor = ancestor.parent()) {
      if (ancestor === node) {
        throw new EditorError(`cannot add a container into itself or its descendant: ${node.value.id()}`);
      }
    }
    this.checkRemove(node);
    parent?.value.checkInsert(node.value);
    this.checkIndex(parent, index, node);
  }

  relocate(node: ShapeNode, parent: ShapeNode | null, index?: number): void {
    this.checkRelocate(node, parent, index);
    this.list(node.parent()).splice(this.indexOf(node), 1);
    this.list(parent).splice(index ?? this.list(parent).length, 0, node);
    states.get(node)!.parent = parent;
  }

  /** 属性快照与结构快照分离；模型可以扩展自身内部属性快照。 */
  capture(root: ShapeNode): ShapeMemento {
    return new ShapeMemento([]).with(this.nodes(root).map((node) => node.value.capture()));
  }

  move(root: ShapeNode, dx: number, dy: number): void {
    for (const node of this.nodes(root)) node.value.move(dx, dy);
  }

  scale(root: ShapeNode, factor: number): void {
    for (const node of this.nodes(root)) node.value.scale(factor);
  }

  captureStructure(): DocumentStructureMemento {
    const roots = [...this.roots];
    const saved = this.nodes().map((node) => ({ node, parent: node.parent(), children: [...node.children()] }));
    return new DocumentStructureMemento(() => {
      // 先检查完整快照，跨文档冲突不能导致半恢复。
      for (const { node } of saved) {
        const owner = owners.get(node.value);
        if (owner !== undefined && owner !== this) {
          throw new EditorError(`shape already attached: ${node.value.id()}`);
        }
      }
      this.checkIdentifiers(saved.map(({ node }) => node.value));
      for (const node of this.byId.values()) {
        owners.delete(node.value);
        states.set(node, { parent: null, children: [] });
      }
      this.byId.clear();
      this.roots.splice(0, this.roots.length, ...roots);
      for (const { node, parent, children } of saved) {
        states.set(node, { parent, children: [...children] });
        this.byId.set(node.value.id(), node);
        owners.set(node.value, this);
      }
    });
  }

  private checkIdentifiers(shapes: readonly Shape[]): void {
    const used = new Set<string>();
    for (const shape of shapes) {
      const ids = shape.identifiers();
      if (!ids.includes(shape.id())) throw new EditorError(`shape identifiers must include root: ${shape.id()}`);
      for (const id of ids) {
        Shape.checkId(id);
        if (used.has(id)) throw new EditorError(`id already exists: ${id}`);
        used.add(id);
      }
    }
  }

  private list(parent: ShapeNode | null): ShapeNode[] {
    return parent === null ? this.roots : states.get(parent)!.children;
  }

  private requireMember(node: ShapeNode): void {
    if (this.byId.get(node.value.id()) !== node) {
      throw new EditorError(`shape is not in document: ${node.value.id()}`);
    }
  }

  private checkParent(parent: ShapeNode | null): void {
    if (parent !== null && this.byId.get(parent.value.id()) !== parent) {
      throw new EditorError(`container is not in document: ${parent.value.label()}`);
    }
  }

  private checkIndex(parent: ShapeNode | null, index?: number, moving?: ShapeNode): void {
    const length = this.list(parent).length - (moving !== undefined && moving.parent() === parent ? 1 : 0);
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index > length)) {
      throw new EditorError(`invalid child index: ${index}`);
    }
  }

  private static checkSize(width: number, height: number): void {
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
      throw new EditorError('canvas size must be positive');
    }
  }
}
