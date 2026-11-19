import type ShapeNode from '../receiver/document/ShapeNode';

export interface CanvasInfo {
  readonly width: number;
  readonly height: number;
}

export interface TreeSuccess {
  readonly kind: 'edit' | 'undo' | 'redo' | 'replace' | 'save';
  readonly nodes: readonly ShapeNode[];
  readonly canvas: CanvasInfo;
}

/** node 为 null 表示画布行；渲染及成功通知只能读取公开信息。 */
export default interface TreeLineRenderer {
  render(node: ShapeNode | null, canvas: CanvasInfo): string;
}
