import type ShapeView from '../document/shape/ShapeView';

export interface CanvasInfo {
  readonly width: number;
  readonly height: number;
}

export interface TreeSuccess {
  readonly kind: 'edit' | 'undo' | 'redo' | 'replace' | 'save';
  readonly nodes: readonly ShapeView[];
  readonly canvas: CanvasInfo;
}

/** node 为 null 表示画布行；渲染及成功通知只能读取公开信息。 */
export default interface TreeLineRenderer {
  render(node: ShapeView | null, canvas: CanvasInfo): string;
}
