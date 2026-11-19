/** 文档结构修改的内部作用域；模型只依赖此机制，不依赖 Document。 */
const editing = new WeakSet<object>();

export function isEditing(root: object): boolean {
  return editing.has(root);
}

export function editStructure<T>(root: object, edit: () => T): T {
  const nested = editing.has(root);
  editing.add(root);
  try {
    return edit();
  } finally {
    if (!nested) editing.delete(root);
  }
}

/** 文档归属与 Shape.parent 分离，只为文档中的顶层图形登记所属文档。 */
const rootOwners = new WeakMap<object, object>();

export function ownerOf(root: object): object | null {
  return rootOwners.get(root) ?? null;
}

export function bindRoot(root: object, owner: object): void {
  if (rootOwners.has(root)) throw new Error('shape already belongs to a document');
  rootOwners.set(root, owner);
}

export function unbindRoot(root: object, owner: object): void {
  if (rootOwners.get(root) !== owner) throw new Error('shape does not belong to this document');
  rootOwners.delete(root);
}
