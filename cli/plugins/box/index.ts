import { TreeDecorator } from '../../src/backend';
import type { AttributeHandler, PluginContributions, Shape, ShapeView } from '../../src/backend';
import Box from './Box';

const geometryKeys = new Set(['x', 'y', 'width', 'height']);
const appearanceKeys = new Set(['fill', 'stroke', 'stroke-width']);

class BoxAttributes {
  static readonly handlerName = 'box-attributes';

  static matches(shape: Shape, key: string): boolean {
    return shape instanceof Box && (key === 'label' || geometryKeys.has(key) || appearanceKeys.has(key));
  }

  static apply(shape: Shape, key: string, token: string): void {
    const box = shape as Box;
    if (key === 'label') {
      box.captionShape().set('text', token);
      return;
    }
    box.frameShape().set(key, token);
    if (geometryKeys.has(key)) box.layoutLabel();
  }

  static display(shape: Shape, key: string): string | null {
    const box = shape as Box;
    return key === 'label' ? box.captionShape().display('text') : box.frameShape().display(key);
  }
}

class BoxTypeLabel extends TreeDecorator {
  static override readonly decoratorName = 'box-type-label';

  protected override tag(node: ShapeView | null): string | null {
    return node?.type === Box.type ? '(box)' : null;
  }
}

export default function activate(): PluginContributions {
  const attributes: AttributeHandler = BoxAttributes;
  return { shapes: [Box], commands: [], attributes: [attributes], decorators: [BoxTypeLabel] };
}
