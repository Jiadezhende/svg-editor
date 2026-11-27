import { EditorError, Shape, TextAttribute } from '../../src/backend';
import type { Attribute, ShapeMemento, ShapeParseResult, ShapeView } from '../../src/backend';
import Rect from '../core/Rect';
import Text from '../core/Text';

const DEFAULT_FILL = '#4a90d9';
const LABEL_OFFSET_X = 20;
const LABEL_OFFSET_Y = 5;

interface Parts {
  readonly frame: Shape;
  readonly caption: Shape;
}

/**
 * 带标题的矩形框：内部矩形与标题由模型持有，普通成员关系仍由文档维护。
 * 外观、标题与几何都不进入自身属性表，统一经 box-attributes 路由到部件。
 */
export default class Box extends Shape {
  static override readonly type = 'box';
  static override readonly createParams = [...Rect.params, new TextAttribute('label')];

  /** 写出为 SVG g 容器。 */
  override element(): string { return 'g'; }

  private readonly frame: Rect;
  private readonly caption: Text;

  constructor(id: string, restored?: Parts) {
    super(id);
    if (restored === undefined) {
      this.frame = new Rect(`${id}-rect`, new Map([['fill', DEFAULT_FILL]]));
      this.caption = new Text(`${id}-label`);
    } else {
      const { frame, caption } = restored;
      if (frame.type() !== Rect.type || frame.id() !== `${id}-rect` || frame.acceptsChildren() ||
        caption.type() !== Text.type || caption.id() !== `${id}-label` || caption.acceptsChildren()) {
        throw new EditorError(`invalid box parts: ${id}`);
      }
      try {
        const captionValues = new Map<string, number | string>(caption.entries());
        const text = caption.content();
        if (text !== null) captionValues.set('text', text);
        this.frame = new Rect(frame.id(), new Map(frame.entries()));
        this.caption = new Text(caption.id(), captionValues);
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
  frameShape(): Rect { return this.frame; }

  /** 标题部件；Handler 通过它读写文字。 */
  captionShape(): Text { return this.caption; }

  /** 按框体位置和尺寸重算文字位置；几何未齐时（创建写入过程中）不处理。 */
  layoutLabel(): void {
    const x = this.frame.value('x');
    const y = this.frame.value('y');
    const height = this.frame.value('height');
    if (typeof x !== 'number' || typeof y !== 'number' || typeof height !== 'number') return;
    this.caption.assign('x', x + LABEL_OFFSET_X);
    this.caption.assign('y', y + height / 2 + LABEL_OFFSET_Y);
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
    this.frame.move(dx, dy);
    this.caption.move(dx, dy);
  }

  override scale(factor: number): void {
    this.frame.scale(factor);
    this.caption.scale(factor);
  }

  protected override viewParts(): readonly ShapeView[] { return [this.frame.view(), this.caption.view()]; }
}
