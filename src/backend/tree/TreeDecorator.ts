import type ShapeNode from '../receiver/document/ShapeNode';
import type TreeLineRenderer from './TreeLineRenderer';
import type { CanvasInfo, TreeSuccess } from './TreeLineRenderer';

/** 经典 Decorator：先委托内层渲染，再追加自己的标签。状态保存在实例中。 */
export default abstract class TreeDecorator implements TreeLineRenderer {
  static readonly decoratorName: string = '';

  constructor(protected readonly wrapped: TreeLineRenderer) {}

  render(node: ShapeNode | null, canvas: CanvasInfo): string {
    const line = this.wrapped.render(node, canvas);
    const tag = this.tag(node, canvas);
    return tag === null || tag === '' ? line : `${line} ${tag}`;
  }

  protected abstract tag(node: ShapeNode | null, canvas: CanvasInfo): string | null;

  /** 只读通知；领域和历史已经提交，禁止在这里修改模型。 */
  onSuccess(_event: TreeSuccess): void {}
}
