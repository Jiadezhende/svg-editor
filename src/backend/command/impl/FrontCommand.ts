import RelocateCommand from '../RelocateCommand';
import type { Destination } from '../RelocateCommand';
import type Document from '../../receiver/document/Document';
import type Shape from '../../receiver/document/shape/Shape';
import type Workspace from '../../receiver/workspace/Workspace';

/** `front <id>`：在兄弟中移到末尾，即最后绘制、显示在最上层。 */
export default class FrontCommand extends RelocateCommand {
  static override readonly command = 'front';
  static override readonly usage = 'front <id>';

  constructor(workspace: Workspace, args: readonly string[]) {
    super(workspace, args[0]);
    this.expectArgCount(args, 1);
  }

  protected destination(_doc: Document, shape: Shape): Destination {
    return [shape.parent()];
  }

  protected describe(shape: Shape): string {
    return `${shape.label()} brought to front`;
  }
}
