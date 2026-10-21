import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import EditorError from '../../error/EditorError';
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

  protected destination(doc: Document, shape: Shape): Destination {
    const container = doc.requireShape(this.containerId).asContainer();
    if (container === null) {
      throw new EditorError(`not a container: ${this.containerId}`);
    }
    if (shape.find(this.containerId) !== null) {
      throw new EditorError(`cannot add a container into itself or its descendant: ${shape.id()}`);
    }
    return [container];
  }

  protected describe(shape: Shape): string {
    return `${shape.label()} added to ${shape.parent().label()}`;
  }
}
