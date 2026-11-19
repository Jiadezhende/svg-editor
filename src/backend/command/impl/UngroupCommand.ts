import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import type Shape from '../../receiver/document/shape/Shape';
import EditorError from '../../error/EditorError';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `ungroup <gid>`：解散容器，子图形按原顺序提升到其父级、占据容器原来的位置。
 * 根级容器（画布根的直接子节点）不可解散。
 */
export default class UngroupCommand extends EditCommand {
  static override readonly command = 'ungroup';
  static override readonly usage = 'ungroup <gid>';

  private readonly id: string;
  /** 本次 execute 解散的容器、它原来的父节点与位置，以及子图形（按原顺序），供 undo 使用。 */
  private ungrouped: { shape: Shape; parent: Shape; index: number; children: readonly Shape[] } | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    doc.requireShape(this.id);
    const shape = doc.requireChildTarget(this.id);
    const parent = shape.parent();
    if (parent === null) throw new EditorError(`cannot ungroup top-level container: ${this.id}`);
    doc.checkRemove(shape);
    const index = parent.children().indexOf(shape);
    const children = shape.children();
    for (const child of children) doc.checkRelocate(child, parent);
    children.forEach((child, i) => doc.relocate(child, parent, index + i));
    doc.remove(shape);
    this.ungrouped = { shape, parent, index, children };
    return new CommandResult().line(`${shape.label()} ungrouped, ${children.length} children moved to ${parent.label()}`);
  }

  undo(): CommandResult {
    if (this.ungrouped === null) {
      throw new Error('undo before execute');
    }
    const { shape, parent, index, children } = this.ungrouped;
    const doc = this.workspace.document();
    doc.checkAdd(shape, parent, index);
    for (const child of children) {
      doc.checkRemove(child);
      shape.checkInsert(child);
    }
    doc.add(shape, parent, index);
    for (const child of children) doc.relocate(child, shape);
    return new CommandResult().line(`${shape.label()} restored into ${parent.label()} with ${children.length} children`);
  }
}
