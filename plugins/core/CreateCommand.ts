import { CommandResult, EditCommand, EditorError } from '../../src/backend';
import type { EditSnapshot, Receiver } from '../../src/backend';

/**
 * `create <type> <id> [params…] [in <containerId>]`：按类型创建图形，挂在画布根或指定容器的末尾。
 *
 * 构造时只按图形类的声明切分参数，保留原始 token；解析与写入由 Receiver 在 apply 中完成。
 * 必填参数按声明顺序；其后第一个词若是 `in` 一律视为关键字，否则视为可选外观参数；最后可跟 `in <containerId>`。
 */
export default class CreateCommand extends EditCommand {
  static override readonly command = 'create';
  static override readonly usage = 'create <type> <id> [params…] [in <containerId>]';

  private static readonly keyword = 'in';

  private readonly shapeDefinition: ReturnType<Receiver['shapeDefinition']>;
  private readonly id: string;
  private readonly inputs: readonly (readonly [string, string])[];
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

    const inputs: (readonly [string, string])[] = params.map(
      (attribute, i) => [attribute.name(), required[i]] as const,
    );
    const paint = this.shapeDefinition.paint;
    if (paint !== null && rest.length > 0 && rest[0] !== CreateCommand.keyword) {
      inputs.push([paint, rest[0]]);
      rest = rest.slice(1);
    }
    if (rest.length === 0) {
      this.containerId = null;
    } else if (rest.length === 2 && rest[0] === CreateCommand.keyword) {
      this.containerId = rest[1];
    } else {
      throw this.wrongArgCount(this.syntax());
    }
    this.inputs = inputs;
  }

  protected snapshot(): EditSnapshot { return this.receiver.document().captureStructure(); }

  protected apply(): { result: CommandResult; undo: string } {
    const doc = this.receiver.document();
    const parent = this.containerId === null ? null : doc.findNode(this.containerId);
    if (this.containerId !== null && parent === null) {
      throw new EditorError(`no such container: ${this.containerId}`);
    }
    const shape = this.receiver.createShape(this.shapeDefinition.type, this.id, this.inputs);
    doc.insert(shape, parent);
    const where = this.containerId === null ? '' : ` in ${parent?.value.modelLabel() ?? 'svg'}`;
    return { result: new CommandResult().line(`${shape.modelLabel()} created${where}`), undo: `${shape.modelLabel()} removed` };
  }

  /** 本类型的完整语法，用于参数个数不符时的提示。 */
  private syntax(): string {
    const { type, params, createParams, paint } = this.shapeDefinition;
    const required = (createParams ?? params).map((attribute) => ` <${attribute.name()}>`).join('');
    const optional = paint === null ? '' : ` [${paint}]`;
    return `create ${type} <id>${required}${optional} [in <containerId>]`;
  }
}
