/** 图形内容的只读快照，包含可展示的私有部件。 */
export default interface ShapeView {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly summary: string;
  readonly container: boolean;
  readonly attributes: ReadonlyArray<readonly [string, number | string]>;
  readonly content: number | string | null;
  readonly children: readonly ShapeView[];
}
