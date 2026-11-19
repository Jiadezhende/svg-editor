import DecimalFormat from '../receiver/document/attribute/DecimalFormat';
import type ShapeNode from '../receiver/document/ShapeNode';
import type TreeLineRenderer from './TreeLineRenderer';
import type { CanvasInfo } from './TreeLineRenderer';

export default class BaseTreeLineRenderer implements TreeLineRenderer {
  private readonly decimal = new DecimalFormat();

  render(node: ShapeNode | null, canvas: CanvasInfo): string {
    if (node === null) return `svg (${this.decimal.format(canvas.width)}x${this.decimal.format(canvas.height)})`;
    const summary = node.value.summary();
    return summary === '' ? node.value.label() : `${node.value.label()}  ${summary}`;
  }
}
