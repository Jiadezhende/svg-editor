import Shape from '../../src/backend/receiver/document/shape/Shape';
import Rect from '../../src/backend/receiver/document/shape/Rect';
import Text from '../../src/backend/receiver/document/shape/Text';
import type ShapeMemento from '../../src/backend/receiver/document/shape/ShapeMemento';

/** 测试复合模型：内部组成不意味着开放成员编辑，不依赖 Group。 */
export default class CompositeShape extends Shape {
  static override readonly type = 'g';

  private readonly frame: Rect;
  private readonly caption: Text;

  constructor(id: string) {
    super(id);
    this.frame = new Rect(`${id}-rect`, new Map([['x', 10], ['y', 20], ['width', 100], ['height', 50]]));
    this.caption = new Text(`${id}-label`, new Map<string, string | number>([['x', 20], ['y', 40], ['text', 'label']]));
  }

  /** 明确的部件查询，用于领域检查和独立的 SVG 映射。 */
  frameShape(): Rect { return this.frame; }
  captionShape(): Text { return this.caption; }

  override capture(): ShapeMemento {
    return super.capture().with([this.frame.capture(), this.caption.capture()]);
  }

  override move(dx: number, dy: number): void {
    this.changeParts(() => { super.move(dx, dy); this.frame.move(dx, dy); this.caption.move(dx, dy); });
  }

  override scale(factor: number): void {
    this.changeParts(() => { super.scale(factor); this.frame.scale(factor); this.caption.scale(factor); });
  }

  private changeParts(change: () => void): void {
    const before = this.capture();
    try { change(); } catch (error) { before.restore(); throw error; }
  }

  setLabel(value: string): void {
    this.caption.set('text', value);
  }

  setFill(value: string): void {
    this.frame.set('fill', value);
  }
}
