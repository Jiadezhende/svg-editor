import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import EditorError from '../../error/EditorError';
import type Container from '../../receiver/document/Container';
import type Shape from '../../receiver/document/shape/Shape';
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
  private ungrouped: {
    shape: Shape;
    group: Container;
    parent: Container;
    index: number;
    children: readonly Shape[];
  } | null = null;

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
    const shape = doc.requireShape(this.id);
    const group = shape.asContainer();
    if (group === null) {
      throw new EditorError(`not a container: ${this.id}`);
    }
    const parent = shape.parent();
    if (parent === doc) {
      throw new EditorError(`cannot ungroup top-level container: ${this.id}`);
    }
    const index = parent.remove(shape);
    const children = [...group.children()];
    children.forEach((child, i) => child.relocate(parent, index + i));
    this.ungrouped = { shape, group, parent, index, children };
    return new CommandResult().line(`${shape.label()} ungrouped, ${children.length} children moved to ${parent.label()}`);
  }

  undo(): CommandResult {
    if (this.ungrouped === null) {
      throw new Error('undo before execute');
    }
    const { shape, group, parent, index, children } = this.ungrouped;
    for (const child of children) {
      child.relocate(group);
    }
    shape.relocate(parent, index);
    return new CommandResult().line(`${shape.label()} restored into ${parent.label()} with ${children.length} children`);
  }
}
