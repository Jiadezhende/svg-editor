import Command from '../Command';
import CommandResult from '../CommandResult';
import type Shape from '../../receiver/document/shape/Shape';
import type Workspace from '../../receiver/workspace/Workspace';

/**
 * `tree [id]`：以树形输出文档结构，每行内联图形的核心属性。
 * 无参时以画布根为根，首行 `svg (<w>x<h>)`；有参时只输出以该图形为根的子树。
 */
export default class TreeCommand extends Command {
  static override readonly command = 'tree';
  static override readonly usage = 'tree [id]';

  /** 子树的根；无参（全文档）时为 null。 */
  private readonly id: string | null;

  constructor(
    private readonly workspace: Workspace,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 0, 1);
    this.id = args[0] ?? null;
  }

  execute(): CommandResult {
    const doc = this.workspace.document();
    const result = new CommandResult();
    if (this.id === null) {
      result.line(`${doc.label()} (${this.formatNumber(doc.width())}x${this.formatNumber(doc.height())})`);
      this.draw(doc.children(), '', result);
    } else {
      const root = doc.requireShape(this.id);
      result.line(this.describe(root));
      this.draw(this.childrenOf(root), '', result);
    }
    return result;
  }

  /** 逐个输出子节点并递归其子树；prefix 为上层累积的连线前缀。 */
  private draw(children: readonly Shape[], prefix: string, result: CommandResult): void {
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      result.line(`${prefix}${last ? '└── ' : '├── '}${this.describe(child)}`);
      this.draw(this.childrenOf(child), `${prefix}${last ? '    ' : '│   '}`, result);
    });
  }

  /** 容器的子节点；叶子没有子节点。 */
  private childrenOf(shape: Shape): readonly Shape[] {
    return shape.asContainer()?.children() ?? [];
  }

  /** 本行内容：`<type>#<id>`，有内联属性时隔 2 个空格接上。 */
  private describe(shape: Shape): string {
    const summary = shape.summary();
    return summary === '' ? shape.label() : `${shape.label()}  ${summary}`;
  }
}
