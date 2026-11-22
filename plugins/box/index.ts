import { TreeDecorator } from '../../src/backend';
import type { AttributeHandler, PluginContributions, Shape, ShapeView, SvgShapeMapping } from '../../src/backend';
import Box from './Box';

class BoxAttributes {
  static readonly handlerName = 'box-attributes';

  static matches(shape: Shape, key: string): boolean {
    return shape instanceof Box && (key === 'fill' || key === 'label');
  }

  static apply(shape: Shape, key: string, token: string): void {
    const box = shape as Box;
    if (key === 'fill') box.setFill(token);
    else box.setLabel(token);
  }

  static display(shape: Shape, key: string): string | null {
    const box = shape as Box;
    return key === 'fill' ? box.displayFill() : box.displayLabel();
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
