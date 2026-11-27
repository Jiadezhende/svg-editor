/**
 * 备忘录：一个或多个图形在某一时刻的属性快照，`restore()` 把它们写回。
 * 由模型生成，也可由 Document 合并为文档子树属性快照；内容封装在恢复动作中。
 */
export default class ShapeMemento {
  constructor(private readonly restorers: ReadonlyArray<() => void>) {}

  /** 与其他快照合并为一个（模型内部部件或文档子树）。 */
  with(others: readonly ShapeMemento[]): ShapeMemento {
    return new ShapeMemento([...this.restorers, ...others.flatMap((other) => other.restorers)]);
  }

  restore(): void {
    for (const restore of this.restorers) {
      restore();
    }
  }
}
