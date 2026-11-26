import { TreeDecorator } from '../../src/backend';
import type { AttributeHandler, PluginContributions, Shape, ShapeView, SvgShapeMapping } from '../../src/backend';
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

const mapping: SvgShapeMapping = {
  matches: (shape) => shape instanceof Box,
  write: (shape) => {
    const box = shape.view();
    return {
      type: 'g',
      attributes: [['id', box.id], ['data-kind', Box.type], ...box.attributes],
      children: box.children.map((part) => ({
        type: part.type,
        attributes: [['id', part.id], ...part.attributes],
        content: part.content,
      })),
    };
  },
};

export default function activate(): PluginContributions {
  const attributes: AttributeHandler = BoxAttributes;
  return { shapes: [{ model: Box, mapping }], commands: [], attributes: [attributes], decorators: [BoxTypeLabel] };
}
