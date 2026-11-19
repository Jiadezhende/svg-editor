import Shape from '../../src/backend/receiver/document/shape/Shape';
import Rect from '../../src/backend/receiver/document/shape/Rect';
import Text from '../../src/backend/receiver/document/shape/Text';

/** 测试复合模型：内部组成不意味着开放成员编辑，不依赖 Group。 */
export default class CompositeShape extends Shape {
  static override readonly type = 'g';

  private readonly frame: Rect;
  private readonly caption: Text;

  constructor(id: string) {
    super(id, new Map(), []);
    this.frame = new Rect(`${id}-rect`, new Map([['x', 10], ['y', 20], ['width', 100], ['height', 50]]));
    this.caption = new Text(`${id}-label`, new Map<string, string | number>([['x', 20], ['y', 40], ['text', 'label']]));
    this.insertChild(this.frame);
    this.insertChild(this.caption);
  }

  override acceptsChildren(): boolean {
    return false;
  }

  setLabel(value: string): void {
    this.caption.set('text', value);
  }

  setFill(value: string): void {
    this.frame.set('fill', value);
  }
}
