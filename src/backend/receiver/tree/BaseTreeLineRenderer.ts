import DecimalFormat from '../../utils/DecimalFormat';
import type ShapeView from '../document/shape/ShapeView';
import type TreeLineRenderer from './TreeLineRenderer';
import type { CanvasInfo } from './TreeLineRenderer';

export default class BaseTreeLineRenderer implements TreeLineRenderer {
  private readonly decimal = new DecimalFormat();

  render(node: ShapeView | null, canvas: CanvasInfo): string {
    if (node === null) return `svg (${this.decimal.format(canvas.width)}x${this.decimal.format(canvas.height)})`;
    return node.summary === '' ? node.label : `${node.label}  ${node.summary}`;
  }
}
