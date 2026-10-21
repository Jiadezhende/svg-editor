import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import EditorError from '../../error/EditorError';
import type Container from '../../receiver/document/Container';
import Group from '../../receiver/document/shape/Group';
import type Shape from '../../receiver/document/shape/Shape';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `group <newGid> <id1> <id2>…`：新建容器并收入若干图形。
 * 成员按文档顺序排列，新容器插在第一个成员原来的位置；整条命令是一个 undo 单元。
 */
export default class GroupCommand extends EditCommand {
  static override readonly command = 'group';
  static override readonly usage = 'group <newGid> <id1> <id2>…';

  private readonly groupId: string;
  private readonly memberIds: readonly string[];
  /** 本次 execute 新建的容器，以及各成员移动前的父节点与位置（按移动顺序），供 undo 使用。 */
  private grouped: { group: Group; moves: { shape: Shape; parent: Container; index: number }[] } | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    if (args.length < 2) {
      throw this.wrongArgCount();
    }
    [this.groupId, ...this.memberIds] = args;
    const duplicate = this.memberIds.find((id, i) => this.memberIds.indexOf(id) !== i);
    if (duplicate !== undefined) {
      throw new EditorError(`duplicate id: ${duplicate}`);
    }
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const group = new Group(this.groupId);
    const members = this.memberIds.map((id) => doc.requireShape(id));
    for (const outer of members) {
      if (members.some((inner) => inner !== outer && outer.find(inner.id()) !== null)) {
        throw new EditorError(`cannot group a container into its own descendant: ${outer.id()}`);
      }
    }

    const order = doc.shapes();
    const sorted = [...members].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const first = sorted[0];
    doc.add(group, first.parent(), first.parent().children().indexOf(first));
    const moves = sorted.map((shape) => {
      const parent = shape.parent();
      const move = { shape, parent, index: parent.children().indexOf(shape) };
      shape.relocate(group);
      return move;
    });
    this.grouped = { group, moves };
    return new CommandResult().line(`${group.label()} created with ${sorted.length} children`);
  }

  undo(): CommandResult {
    if (this.grouped === null) {
      throw new Error('undo before execute');
    }
    const { group, moves } = this.grouped;
    for (const { shape, parent, index } of [...moves].reverse()) {
      shape.relocate(parent, index);
    }
    group.parent().remove(group);
    return new CommandResult().line(`${group.label()} removed, ${moves.length} children restored`);
  }
}
