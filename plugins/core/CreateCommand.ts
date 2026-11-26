import { EditorError } from '../../src/backend';
import { CommandResult } from '../../src/backend';
import { EditCommand } from '../../src/backend';
import { UndoRecord } from '../../src/backend';
import type { Receiver } from '../../src/backend';

/**
 * `create <type> <id> [params…] [in <containerId>]`：按类型创建图形，挂在画布根或指定容器的末尾。
 *
 * 参数按图形类的声明解析：必填参数按 `params` 顺序；其后第一个词若是 `in` 一律视为关键字，
 * 否则视为可选外观参数 `paint`；最后可跟 `in <containerId>`。
 */
export default class CreateCommand extends EditCommand {
  static override readonly command = 'create';
  static override readonly usage = 'create <type> <id> [params…] [in <containerId>]';
  private readonly undoRecord = new UndoRecord();

  private static readonly keyword = 'in';

  private readonly shapeDefinition: ReturnType<Receiver['shapeDefinition']>;
  private readonly id: string;
  private readonly values = new Map<string, number | string>();
  private readonly containerId: string | null;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    if (args.length === 0) {
      throw this.wrongArgCount();
    }
    this.shapeDefinition = receiver.shapeDefinition(args[0]);

    const params = this.shapeDefinition.createParams ?? this.shapeDefinition.params;
    if (args.length < 2 + params.length) {
      throw this.wrongArgCount(this.syntax());
    }
    this.id = args[1];
    const required = args.slice(2, 2 + params.length);
    let rest = args.slice(2 + params.length);

    const paint = this.shapeDefinition.paint;
    let paintToken: string | null = null;
    if (paint !== null && rest.length > 0 && rest[0] !== CreateCommand.keyword) {
      paintToken = rest[0];
      rest = rest.slice(1);
    }
    if (rest.length === 0) {
      this.containerId = null;
    } else if (rest.length === 2 && rest[0] === CreateCommand.keyword) {
      this.containerId = rest[1];
    } else {
      throw this.wrongArgCount(this.syntax());
    }

    params.forEach((spec, i) => this.values.set(spec.name(), spec.withToken(required[i]).value as number | string));
    if (paint !== null && paintToken !== null) {
      this.parseValue(paint, paintToken);
    }
  }

  undo(): CommandResult { return this.undoRecord.undo(); }

  execute(): CommandResult {
    const doc = this.receiver.document();
    return this.undoRecord.execute(doc.captureStructure(), () => {
      const parent = this.containerId === null ? null : doc.findNode(this.containerId);
      if (this.containerId !== null && parent === null) throw new EditorError(`no such container: ${this.containerId}`);
      if (parent !== null && !parent.value.acceptsChildren()) throw new EditorError(`not a container: ${this.containerId}`);
      const shape = this.receiver.createShape(this.shapeDefinition.type, this.id, this.values);
      doc.insert(shape, parent);
      const where = this.containerId === null ? '' : ` in ${parent?.value.label() ?? 'svg'}`;
      return { result: new CommandResult().line(`${shape.label()} created${where}`), undo: `${shape.label()} removed` };
    });
  }

  private parseValue(name: string, token: string): void {
    const spec = this.shapeDefinition.attribute(name);
    if (spec === null) {
      throw new Error(`${this.shapeDefinition.type} declares paint ${name} without such attribute`);
    }
    this.values.set(name, spec.withToken(token).value as number | string);
  }

  /** 本类型的完整语法，用于参数个数不符时的提示。 */
  private syntax(): string {
    const { type, params, createParams, paint } = this.shapeDefinition;
    const required = (createParams ?? params).map((spec) => ` <${spec.name()}>`).join('');
    const optional = paint === null ? '' : ` [${paint}]`;
    return `create ${type} <id>${required}${optional} [in <containerId>]`;
  }
}
