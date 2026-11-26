import { CoordinateAttribute, EditorError, LengthAttribute, Shape, SvgWriter, TextAttribute } from '../../src/backend';
import type { ShapeMemento, ShapeParseResult, SvgShapeMapping } from '../../src/backend';

/** 仅依赖公共入口的持久化测试模型，不参与默认装配。 */
export class Frame extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new LengthAttribute('width'), new LengthAttribute('height')];

  override move(dx: number, dy: number): void {
    this.assign('x', this.number('x') + dx);
    this.assign('y', this.number('y') + dy);
  }

  override scale(factor: number): void {
    this.assign('x', this.number('x') * factor);
    this.assign('y', this.number('y') * factor);
    this.assign('width', this.number('width') * factor);
    this.assign('height', this.number('height') * factor);
  }
}

export class Caption extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new TextAttribute('text')];
  static override readonly content = 'text';

  override move(dx: number, dy: number): void {
    this.assign('x', this.number('x') + dx);
    this.assign('y', this.number('y') + dy);
  }

  override scale(factor: number): void {
    this.assign('x', this.number('x') * factor);
    this.assign('y', this.number('y') * factor);
  }
}

export class Panel extends Shape {
  static override readonly type: string = 'test-panel';

  constructor(
    id: string,
    values: ReadonlyMap<string, number | string> = new Map(),
    private readonly frame: Shape = new Frame(`${id}-frame`, new Map([['x', 1], ['y', 2], ['width', 20], ['height', 10]])),
    private readonly caption: Shape = new Caption(`${id}-caption`, new Map<string, number | string>([['x', 3], ['y', 4], ['text', 'hello']])),
  ) {
    super(id, values);
  }

  static override parse(id: string, attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
    const parts = readChildren();
    const frame = parts.find((shape) => shape.id() === `${id}-frame`);
    const caption = parts.find((shape) => shape.id() === `${id}-caption`);
    if (frame?.type() !== 'rect' || caption?.type() !== 'text') throw new EditorError(`invalid panel parts: ${id}`);
    return {
      shape: new Panel(id, this.parseValues(attributes), frame, caption),
      children: parts.filter((shape) => shape !== frame && shape !== caption),
    };
  }

  override acceptsChildren(): boolean { return true; }
  frameShape(): Shape { return this.frame; }
  captionShape(): Shape { return this.caption; }
  setLabel(value: string): void { this.caption.set('text', value); }

  override identifiers(): readonly string[] {
    return [this.id(), ...this.frame.identifiers(), ...this.caption.identifiers()];
  }

  override capture(): ShapeMemento {
    return super.capture().with([this.frame.capture(), this.caption.capture()]);
  }

  override move(dx: number, dy: number): void {
    this.frame.move(dx, dy);
    this.caption.move(dx, dy);
  }

  override scale(factor: number): void {
    this.frame.scale(factor);
    this.caption.scale(factor);
  }
}

export const panelMapping: SvgShapeMapping = {
  matches: (shape) => shape instanceof Panel,
  write: (shape) => {
    const panel = shape as Panel;
    return {
      type: 'g',
      attributes: [['id', panel.id()], ['data-kind', Panel.type], ...panel.entries()],
      children: [SvgWriter.elementOf(panel.frameShape()), SvgWriter.elementOf(panel.captionShape())],
    };
  },
};
