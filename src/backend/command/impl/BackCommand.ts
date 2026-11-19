import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import type Document from '../../receiver/document/Document';
import type ShapeNode from '../../receiver/document/ShapeNode';
import type Workspace from '../../receiver/workspace/Workspace';

/** `back <id>`：在兄弟中移到开头，即最先绘制、显示在最下层。 */
export default class BackCommand extends RelocateCommand {
  static override readonly command = 'back';
  static override readonly usage = 'back <id>';

  constructor(workspace: Workspace, args: readonly string[]) {
    super(workspace, args[0]);
    this.expectArgCount(args, 1);
  }

  protected destination(_doc: Document, node: ShapeNode): Destination {
    return [node.parent(), 0];
  }

  protected describe(node: ShapeNode): string {
    return `${node.value.label()} sent to back`;
  }
}
