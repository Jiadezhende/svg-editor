import CommandResult from './CommandResult';
import StructureCommand from './StructureCommand';
import type Document from '../receiver/document/Document';
import type ShapeNode from '../receiver/document/ShapeNode';
import type Workspace from '../receiver/workspace/Workspace';

export type Destination = readonly [ShapeNode | null, number?];

/** 结构移动公共用例；子类只声明目标与回显。 */
export default abstract class RelocateCommand extends StructureCommand {
  constructor(private readonly workspace: Workspace, private readonly id: string) { super(); }

  execute(): CommandResult {
    const doc = this.workspace.document();
    return this.edit(doc, () => {
      const node = doc.requireNode(this.id);
      const [target, index] = this.destination(doc, node);
      const parent = doc.parent(node);
      doc.relocate(node, target, index);
      return {
        result: new CommandResult().line(this.describe(node)),
        undo: `${node.value.label()} restored into ${parent?.value.label() ?? 'svg'}`,
      };
    });
  }

  protected abstract destination(doc: Document, node: ShapeNode): Destination;
  protected abstract describe(node: ShapeNode): string;
}
