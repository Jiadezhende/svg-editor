import { CoordinateAttribute, EditorError, LengthAttribute, Shape, TextAttribute } from '../../src/backend';
import type { Attribute, ShapeMemento, ShapeParseResult, ShapeView } from '../../src/backend';

const DEFAULT_FILL = '#4a90d9';
const LABEL_OFFSET_X = 20;
const LABEL_OFFSET_Y = 5;

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

  /** 写入文字坐标；任一次写入失败时恢复原值。 */
  place(x: number, y: number): void {
    const before = this.capture();
    try {
      this.assignValue('x', x);
      this.assignValue('y', y);
    } catch (error) {
      before.restore();
      throw error;
    }
  }
}

interface Parts {
  readonly frame: Shape;
  readonly caption: Shape;
}

/**
 * 带标题的矩形框：内部 `Frame` 与 `Caption` 由模型持有，普通成员关系仍由文档维护。
 * 外观、标题与几何都不进入自身属性表，统一经 box-attributes 路由到部件。
 */
export default class Box extends Shape {
  static override readonly type = 'box';
  static override readonly createParams = [...Frame.params, new TextAttribute('label')];

  private readonly frame: Frame;
  private readonly caption: Caption;

  constructor(id: string, restored?: Parts) {
    super(id);
    if (restored === undefined) {
      this.frame = new Frame(`${id}-rect`, new Map([['fill', DEFAULT_FILL]]));
      this.caption = new Caption(`${id}-label`);
    } else {
      const { frame, caption } = restored;
      if (frame.type() !== Frame.type || frame.id() !== `${id}-rect` || frame.acceptsChildren() ||
        caption.type() !== Caption.type || caption.id() !== `${id}-label` || caption.acceptsChildren()) {
        throw new EditorError(`invalid box parts: ${id}`);
      }
      try {
        const captionValues = new Map<string, number | string>(caption.entries());
        const text = caption.content();
        if (text !== null) captionValues.set('text', text);
        this.frame = new Frame(frame.id(), new Map(frame.entries()));
        this.caption = new Caption(caption.id(), captionValues);
      } catch (error) {
        throw new EditorError(`invalid box parts: ${id} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }

  static override parse(
    id: string,
    _attributes: ReadonlyMap<string, string>,
    readChildren: () => readonly Shape[],
  ): ShapeParseResult {
    const children = readChildren();
    const frame = children.find((child) => child.id() === `${id}-rect`);
    const caption = children.find((child) => child.id() === `${id}-label`);
    if (frame === undefined || caption === undefined) throw new EditorError(`invalid box parts: ${id}`);
    const shape = new Box(id, { frame, caption });
    shape.validate();
    return { shape, children: children.filter((child) => child !== frame && child !== caption) };
  }

  /** 外观、标题和几何都由部件承载，自身不声明属性。 */
  static override attributes(): readonly Attribute[] {
    return [];
  }

  /** 框体部件；Handler 通过它读写几何与外观。 */
  frameShape(): Shape { return this.frame; }

  /** 标题部件；Handler 通过它读写文字。 */
  captionShape(): Shape { return this.caption; }

  /** 按框体位置和尺寸重算文字位置；几何未齐时（创建写入过程中）不处理。 */
  layoutLabel(): void {
    const x = this.frame.value('x');
    const y = this.frame.value('y');
    const height = this.frame.value('height');
    if (typeof x !== 'number' || typeof y !== 'number' || typeof height !== 'number') return;
    this.caption.place(x + LABEL_OFFSET_X, y + height / 2 + LABEL_OFFSET_Y);
  }

  override validate(): void {
    super.validate();
    this.frame.validate();
    this.caption.validate();
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

  protected override treeLabel(): string { return `g#${this.id()}`; }

  protected override viewParts(): readonly ShapeView[] { return [this.frame.view(), this.caption.view()]; }

  private changeParts(change: () => void): void {
    const before = this.capture();
    try { change(); }
    catch (error) { before.restore(); throw error; }
  }
}
