import {
  CommandResult, CoordinateAttribute, EditCommand, EditorError, Shape, UndoRecord,
} from '../../src/backend';
import type { Receiver } from '../../src/backend';

/** 仅依赖公共入口的测试扩展，不参与默认宿主装配。 */
export class Marker extends Shape {
  static override readonly type = 'test-marker';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y')];

  override move(dx: number, dy: number): void {
    this.assign('x', this.number('x') + dx);
    this.assign('y', this.number('y') + dy);
  }

  override scale(factor: number): void {
    this.assign('x', this.number('x') * factor);
    this.assign('y', this.number('y') * factor);
  }

  nudge(dx: number): void {
    this.move(dx, 0);
  }
}

/** 静态 Handler 扩展：属性名和别名只在 matches 中声明。 */
export class MarkerAttributesHandler {
  static readonly handlerName = 'test-marker-attributes';

  private constructor() {}

  static matches(shape: Shape, key: string): boolean {
    return shape instanceof Marker && (key === 'horizontal' || key === 'left');
  }

  static apply(shape: Shape, _key: string, token: string): void {
    shape.set('x', token);
  }

  static display(shape: Shape, _key: string): string | null {
    return shape.display('x');
  }
}

export class NudgeMarkerCommand extends EditCommand {
  static override readonly command = 'nudge-marker';
  static override readonly usage = 'nudge-marker <id> <dx>';

  private readonly id: string;
  private readonly dx: number;
  private readonly record = new UndoRecord();

  constructor(private readonly receiver: Receiver, args: readonly string[]) {
    super();
    this.expectArgCount(args, 2);
    this.id = args[0];
    this.dx = this.parseNumber(args[1]);
  }

  execute(): CommandResult {
    const model = this.receiver.document().requireNode(this.id).value;
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
