import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import type Document from '../../receiver/document/Document';
import type Shape from '../../receiver/document/shape/Shape';
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

  protected destination(doc: Document, _shape: Shape): Destination {
    doc.requireShape(this.containerId);
    const container = doc.requireChildTarget(this.containerId);
    return [container];
  }

  protected describe(shape: Shape): string {
    return `${shape.label()} added to ${shape.requireParent().label()}`;
  }
}
