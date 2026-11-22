import { TreeDecorator } from '../../src/backend';
import type { ShapeNode, TreeSuccess } from '../../src/backend';

/** 用于验证实例状态与成功通知，不是正式 dirty 插件。 */
export class TestChangedDecorator extends TreeDecorator {
  static override readonly decoratorName = 'test-changed';
  private changed = false;

  protected override tag(): string | null { return this.changed ? '*' : null; }

  override onSuccess(event: TreeSuccess): void {
    this.changed = event.kind !== 'save' && event.kind !== 'replace';
  }
}

export class TestTypeDecorator extends TreeDecorator {
  static override readonly decoratorName = 'test-type';
  protected override tag(node: ShapeNode | null): string | null {
    return node?.value.type() === 'g' ? '(group)' : null;
  }
}
