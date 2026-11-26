import { CoordinateAttribute, EditorError, LengthAttribute, Shape, TextAttribute } from '../../src/backend';
import type { ShapeMemento, ShapeParseResult, ShapeView } from '../../src/backend';

type Values = ReadonlyMap<string, number | string>;

class Frame extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'),
    new LengthAttribute('width'), new LengthAttribute('height'),
  ];

  override summary(): string {
    const fill = this.display('fill');
    return fill === null ? super.summary() : `${super.summary()} fill=${fill}`;
  }
}

class Caption extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new TextAttribute('text')];
  static override readonly content = 'text';
}

interface Parts {
  readonly frame: Shape;
  readonly caption: Shape;
}

export default class Box extends Shape {
  static override readonly type = 'box';
  static override readonly createParams = [...Frame.params, new TextAttribute('label')];

  private readonly frame: Frame;
  private readonly caption: Caption;

  constructor(id: string, values: Values = new Map(), restored?: Parts) {
    const appearance = new Map(values);
    for (const spec of Box.createParams) appearance.delete(spec.name());
    super(id, appearance);
    if (restored === undefined) {
      const frameValues = new Map<string, number | string>([['fill', '#4a90d9']]);
      for (const spec of Frame.params) frameValues.set(spec.name(), Box.required(values, spec.name()));
      this.frame = new Frame(`${id}-rect`, frameValues);
      this.caption = new Caption(`${id}-label`, new Map<string, number | string>([
        ['x', Number(this.frame.value('x')) + 20],
        ['y', Number(this.frame.value('y')) + Number(this.frame.value('height')) / 2 + 5],
        ['text', Box.required(values, 'label')],
      ]));
    } else {
      const { frame, caption } = restored;
      if (frame.type() !== Frame.type || frame.id() !== `${id}-rect` || frame.acceptsChildren() ||
        caption.type() !== Caption.type || caption.id() !== `${id}-label` || caption.acceptsChildren()) {
        throw new EditorError(`invalid box parts: ${id}`);
      }
      try {
        const captionValues = new Map(caption.entries());
        const text = caption.content();
        if (text !== null) captionValues.set('text', text);
        this.frame = new Frame(frame.id(), new Map(frame.entries()));
        this.caption = new Caption(caption.id(), captionValues);
      } catch (error) {
        throw new EditorError(`invalid box parts: ${id} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }

  static override parse(id: string, attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
    const children = readChildren();
    const frame = children.find((child) => child.id() === `${id}-rect`);
    const caption = children.find((child) => child.id() === `${id}-label`);
    if (frame === undefined || caption === undefined) throw new EditorError(`invalid box parts: ${id}`);
    return {
      shape: new Box(id, this.parseValues(attributes), { frame, caption }),
      children: children.filter((child) => child !== frame && child !== caption),
    };
  }

  override acceptsChildren(): boolean { return true; }

  override checkUngroup(): never {
    throw new EditorError(`cannot ungroup composite shape: ${this.id()}`);
  }

  override identifiers(): readonly string[] {
    return [this.id(), this.frame.id(), this.caption.id()];
  }

  override capture(): ShapeMemento {
    return super.capture().with([this.frame.capture(), this.caption.capture()]);
  }

  override move(dx: number, dy: number): void {
    this.changeParts(() => {
      this.frame.move(dx, dy);
      this.caption.move(dx, dy);
    });
  }

  override scale(factor: number): void {
    this.changeParts(() => {
      this.frame.scale(factor);
      this.caption.scale(factor);
    });
  }

  setFill(value: string): void { this.frame.set('fill', value); }
  setLabel(value: string): void { this.caption.set('text', value); }
  displayFill(): string | null { return this.frame.display('fill'); }
  displayLabel(): string | null { return this.caption.display('text'); }

  protected override treeLabel(): string { return `g#${this.id()}`; }
  protected override viewParts(): readonly ShapeView[] { return [this.frame.view(), this.caption.view()]; }

  private changeParts(change: () => void): void {
    const before = this.capture();
    try { change(); }
    catch (error) { before.restore(); throw error; }
  }

  private static required(values: Values, key: string): number | string {
    const value = values.get(key);
    if (value === undefined) throw new EditorError(`missing attribute: ${key}`);
    return value;
  }
}
