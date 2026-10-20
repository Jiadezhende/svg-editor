import CommandResult from '../CommandResult';
import EditCommand from '../EditCommand';
import type { AttributeValue } from '../../receiver/document/attribute/AttributeSpec';
import type Shape from '../../receiver/document/shape/Shape';
import type { ShapeClass } from '../../receiver/document/shape/ShapeFactory';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `create <type> <id> [params…] [in <containerId>]`：按类型创建图形，挂在画布根或指定容器的末尾。
 *
 * 参数按图形类的声明解析：必填参数按 `params` 顺序；其后第一个词若是 `in` 一律视为关键字，
 * 否则视为可选外观参数 `paint`；最后可跟 `in <containerId>`。
 */
export default class CreateCommand extends EditCommand {
  static override readonly command = 'create';
  static override readonly usage = 'create <type> <id> [params…] [in <containerId>]';

  private static readonly keyword = 'in';

  private readonly shapeClass: ShapeClass;
  private readonly id: string;
  private readonly values = new Map<string, AttributeValue>();
  private readonly containerId: string | null;
  /** 本次 execute 创建的图形，供 undo 使用。 */
  private created: Shape | null = null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    if (args.length === 0) {
      throw this.wrongArgCount();
    }
    this.shapeClass = workspace.shapes().lookup(args[0]);

    const params = this.shapeClass.params;
    if (args.length < 2 + params.length) {
      throw this.wrongArgCount(this.syntax());
    }
    this.id = args[1];
    const required = args.slice(2, 2 + params.length);
    let rest = args.slice(2 + params.length);

    const paint = this.shapeClass.paint;
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

    params.forEach((spec, i) => this.values.set(spec.name(), spec.parse(required[i])));
    if (paint !== null && paintToken !== null) {
      this.parseValue(paint, paintToken);
    }
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const parent = this.containerId === null ? doc : doc.requireContainer(this.containerId);
    const shape = new this.shapeClass(this.id, this.values);
    doc.add(shape, parent);
    this.created = shape;
    const where = this.containerId === null ? '' : ` in ${parent.label()}`;
    return new CommandResult().line(`${shape.label()} created${where}`);
  }

  undo(): CommandResult {
    const shape = this.created;
    if (shape === null) {
      throw new Error('undo before execute');
    }
    shape.parent().remove(shape);
    return new CommandResult().line(`${shape.label()} removed`);
  }

  private parseValue(name: string, token: string): void {
    const spec = this.shapeClass.attribute(name);
    if (spec === null) {
      throw new Error(`${this.shapeClass.type} declares paint ${name} without such attribute`);
    }
    this.values.set(name, spec.parse(token));
  }

  /** 本类型的完整语法，用于参数个数不符时的提示。 */
  private syntax(): string {
    const { type, params, paint } = this.shapeClass;
    const required = params.map((spec) => ` <${spec.name()}>`).join('');
    const optional = paint === null ? '' : ` [${paint}]`;
    return `create ${type} <id>${required}${optional} [in <containerId>]`;
  }
}
