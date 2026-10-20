/**
 * 备忘录：一个或多个图形在某一时刻的属性快照，`restore()` 把它们写回。
 * 只由 Shape.capture() 生成；快照内容封装在恢复动作中，不对外暴露。
 */
export default class ShapeMemento {
  constructor(private readonly restorers: ReadonlyArray<() => void>) {}

  /** 与其他快照合并为一个（容器连同子树）。 */
  with(others: readonly ShapeMemento[]): ShapeMemento {
    return new ShapeMemento([...this.restorers, ...others.flatMap((other) => other.restorers)]);
  }

  restore(): void {
    for (const restore of this.restorers) {
      restore();
    }
  }
}
