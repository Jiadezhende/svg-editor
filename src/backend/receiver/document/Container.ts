import type Shape from './shape/Shape';

/** 能容纳子图形的节点：画布根（Document）与容器（Group）。 */
export default interface Container {
  /** 回显用的名字：画布根为 `svg`，容器为 `g#<id>`。 */
  label(): string;

  /** 子图形，按绘制顺序（先绘制者在前）。 */
  children(): readonly Shape[];

  /** 把 shape 插到 index 处，省略时追加到末尾；shape 的父节点随之变为本节点。 */
  insert(shape: Shape, index?: number): void;

  /** 摘除子图形 shape，返回它原来的位置。 */
  remove(shape: Shape): number;
}
