import EditorError from '../../error/EditorError';
import ChildList from './ChildList';
import type Container from './Container';
import type Shape from './shape/Shape';

/** viewBox 的四个分量：min-x、min-y、width、height。 */
type ViewBox = readonly [number, number, number, number];

/**
 * 当前文档，即画布根 `svg`：画布尺寸、viewBox 与顶层图形；顶层图形的父节点就是 Document。
 * 不变量：画布宽高须为正数；id 全文档唯一。校验失败时状态不变。
 */
export default class Document implements Container {
  private canvasWidth: number;
  private canvasHeight: number;
  private readonly canvasViewBox: ViewBox;
  private readonly roots = new ChildList(this);

  /** 新建文档，viewBox 为 `0 0 w h`。 */
  constructor(width: number, height: number) {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvasViewBox = [0, 0, width, height];
  }

  width(): number {
    return this.canvasWidth;
  }

  height(): number {
    return this.canvasHeight;
  }

  viewBox(): ViewBox {
    return this.canvasViewBox;
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
    return this.roots.all();
  }

  insert(shape: Shape, index?: number): void {
    this.roots.insert(shape, index);
  }

  remove(shape: Shape): number {
    return this.roots.remove(shape);
  }

  /** 全部图形，按先序遍历（即绘制顺序）。 */
  shapes(): Shape[] {
    const result: Shape[] = [];
    const visit = (children: readonly Shape[]): void => {
      for (const shape of children) {
        result.push(shape);
        visit(shape.asContainer()?.children() ?? []);
      }
    };
    visit(this.children());
    return result;
  }

  /** 在整棵图形树中按 id 查找。 */
  find(id: string): Shape | null {
    return this.roots.find(id);
  }

  /** 按 id 取图形，不存在时报错。 */
  requireShape(id: string): Shape {
    const shape = this.find(id);
    if (shape === null) {
      throw new EditorError(`no such shape: ${id}`);
    }
    return shape;
  }

  /** 按 id 取容器，不存在或不是容器时报错。 */
  requireContainer(id: string): Container {
    const shape = this.find(id);
    if (shape === null) {
      throw new EditorError(`no such container: ${id}`);
    }
    const container = shape.asContainer();
    if (container === null) {
      throw new EditorError(`not a container: ${id}`);
    }
    return container;
  }

  /** 把新图形插到本文档中 parent 的 index 处（省略时追加到末尾）；id 已存在时报错。 */
  add(shape: Shape, parent: Container, index?: number): void {
    if (this.find(shape.id()) !== null) {
      throw new EditorError(`id already exists: ${shape.id()}`);
    }
    parent.insert(shape, index);
  }

  private static checkSize(width: number, height: number): void {
    if (!(width > 0 && height > 0)) {
      throw new EditorError('canvas size must be positive');
    }
  }
}
