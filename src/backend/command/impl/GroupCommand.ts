import CommandResult from '../CommandResult';
import StructureCommand from '../StructureCommand';
import EditorError from '../../error/EditorError';
import Group from '../../receiver/document/shape/Group';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `group <newGid> <id1> <id2>…`：新建容器并收入若干图形。
 * 成员按文档顺序排列，新容器插在第一个成员原来的位置；整条命令是一个 undo 单元。
 */
export default class GroupCommand extends StructureCommand {
  static override readonly command = 'group';
  static override readonly usage = 'group <newGid> <id1> <id2>…';

  private readonly groupId: string;
  private readonly memberIds: readonly string[];
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
    return this.edit(doc, () => {
      const group = new Group(this.groupId);
      const members = this.memberIds.map((id) => doc.requireNode(id));
      for (const outer of members) {
        if (members.some((inner) => inner !== outer && doc.nodes(outer).includes(inner))) {
          throw new EditorError(`cannot group a container into its own descendant: ${outer.value.id()}`);
        }
        doc.checkRemove(outer);
        group.checkInsert(outer.value);
      }
      const order = doc.nodes();
      const sorted = [...members].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const first = sorted[0];
      const node = doc.insert(group, doc.parent(first), doc.indexOf(first));
      for (const member of sorted) doc.relocate(member, node);
      return {
        result: new CommandResult().line(`${group.label()} created with ${members.length} children`),
        undo: `${group.label()} removed, ${members.length} children restored`,
      };
    });
  }
}
