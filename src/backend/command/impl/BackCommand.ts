import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import type Document from '../../receiver/document/Document';
import type Shape from '../../receiver/document/shape/Shape';
import type Workspace from '../../receiver/workspace/Workspace';

/** `back <id>`：在兄弟中移到开头，即最先绘制、显示在最下层。 */
export default class BackCommand extends RelocateCommand {
  static override readonly command = 'back';
  static override readonly usage = 'back <id>';

  constructor(workspace: Workspace, args: readonly string[]) {
    super(workspace, args[0]);
    this.expectArgCount(args, 1);
  }

  protected destination(_doc: Document, shape: Shape): Destination {
    return [shape.parent(), 0];
  }

  protected describe(shape: Shape): string {
    return `${shape.label()} sent to back`;
  }
}
