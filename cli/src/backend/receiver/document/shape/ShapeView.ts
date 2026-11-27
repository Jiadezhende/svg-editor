/** 图形内容的只读快照，包含展示明细与可展示的私有部件。 */
export default interface ShapeView {
  readonly id: string;
  readonly type: string;
  /** 文件身份：`<element>#<id>`，供 tree/show 使用。 */
  readonly label: string;
  readonly summary: string;
  readonly container: boolean;
  readonly attributes: ReadonlyArray<readonly [string, number | string]>;
  readonly content: number | string | null;
  readonly details: readonly string[];
  readonly children: readonly ShapeView[];
}
