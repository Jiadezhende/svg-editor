import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import type Document from '../../receiver/document/Document';
import type ShapeNode from '../../receiver/document/ShapeNode';
import type Workspace from '../../receiver/workspace/Workspace';

/** `addto <gid> <id>`：把已有图形移入容器，作为最后一个子节点；目标已是其父容器时同样移到末尾。 */
export default class AddtoCommand extends RelocateCommand {
  static override readonly command = 'addto';
  static override readonly usage = 'addto <gid> <id>';

  private readonly containerId: string;

  constructor(workspace: Workspace, args: readonly string[]) {
    super(workspace, args[1]);
    this.expectArgCount(args, 2);
    this.containerId = args[0];
  }

  protected destination(doc: Document, _node: ShapeNode): Destination {
    doc.requireShape(this.containerId);
    const container = doc.requireChildTarget(this.containerId);
    return [container];
  }

  protected describe(node: ShapeNode): string {
    return `${node.value.label()} added to ${node.parent()!.value.label()}`;
  }
}
