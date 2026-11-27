/** 一个图形自身及私有部件的 SVG 元素描述；文档成员由 Writer 追加。 */
export interface SvgElement {
  readonly type: string;
  readonly attributes: ReadonlyArray<readonly [string, number | string]>;
  readonly content?: number | string | null;
  readonly children?: readonly SvgElement[];
}
