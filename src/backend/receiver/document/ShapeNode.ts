import type Shape from './shape/Shape';

/** 只读文档节点；关系存储与写入权限由 Document 的闭包持有。 */
export default class ShapeNode {
  readonly #value: Shape;
  readonly #readRelations: () => { readonly parent: ShapeNode | null; readonly children: readonly ShapeNode[] };

  constructor(
    value: Shape,
    readRelations: () => { readonly parent: ShapeNode | null; readonly children: readonly ShapeNode[] },
  ) {
    this.#value = value;
    this.#readRelations = readRelations;
  }

  get value(): Shape { return this.#value; }
  parent(): ShapeNode | null { return this.#readRelations().parent; }
  children(): readonly ShapeNode[] { return [...this.#readRelations().children]; }
}
