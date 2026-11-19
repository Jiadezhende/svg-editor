import {
  CommandResult, CoordinateSpec, EditCommand, EditorError, Shape, UndoRecord,
} from '../../src/backend';
import type { Workspace } from '../../src/backend';

/** 仅依赖公共入口的测试扩展，不参与默认宿主装配。 */
export class Marker extends Shape {
  static override readonly type = 'test-marker';
  static override readonly params = [new CoordinateSpec('x', 'x'), new CoordinateSpec('y', 'y')];

  nudge(dx: number): void {
    this.move(dx, 0);
  }
}

export class NudgeMarkerCommand extends EditCommand {
  static override readonly command = 'nudge-marker';
  static override readonly usage = 'nudge-marker <id> <dx>';

  private readonly id: string;
  private readonly dx: number;
  private readonly record = new UndoRecord();

  constructor(private readonly workspace: Workspace, args: readonly string[]) {
    super();
    this.expectArgCount(args, 2);
    this.id = args[0];
    this.dx = this.parseNumber(args[1]);
  }

  execute(): CommandResult {
    const model = this.workspace.document().requireNode(this.id).value;
    if (!(model instanceof Marker)) throw new EditorError('expected test-marker');
    return this.record.execute(model.capture(), () => {
      model.nudge(this.dx);
      return { result: new CommandResult().line(`${model.label()} nudged`), undo: `${model.label()} restored` };
    });
  }

  undo(): CommandResult {
    return this.record.undo();
  }
}
