import { Command } from '../../src/backend';
import { CommandResult } from '../../src/backend';
import type { Receiver, ShapeView } from '../../src/backend';

/**
 * `show <id>`：输出节点及其私有组件的明细。
 * 首行是节点的文件身份与父节点；组件递归展开，文档成员仍由 tree 表达。
 */
export default class ShowCommand extends Command {
  static override readonly command = 'show';
  static override readonly usage = 'show <id>';

  private readonly id: string;

  constructor(
    private readonly receiver: Receiver,
    args: readonly string[],
  ) {
    super();
    this.expectArgCount(args, 1);
    this.id = args[0];
  }

  execute(): CommandResult {
    const doc = this.receiver.document();
    const node = doc.requireNode(this.id);
    const result = new CommandResult();
    this.render(result, node.value.view(), node.parent()?.value.fileLabel() ?? 'svg', 0, node.children().length);
    return result;
  }

  /** 首行带父节点；组件块不带 `parent=`，层级由缩进表达。 */
  private render(
    result: CommandResult,
    view: ShapeView,
    parentLabel: string | null,
    depth: number,
    memberCount: number,
  ): void {
    const indent = '  '.repeat(depth);
    const parent = parentLabel === null ? '' : `  parent=${parentLabel}`;
    result.line(`${indent}${view.label}${parent}`);
    if (depth === 0 && view.container && view.children.length === 0) {
      result.line(`${indent}  children=${memberCount}`);
    }
    for (const detail of view.details) {
      if (detail === '') continue;
      result.line(`${indent}  ${detail}`);
    }
    for (const component of view.children) {
      this.render(result, component, null, depth + 1, 0);
    }
  }
}
