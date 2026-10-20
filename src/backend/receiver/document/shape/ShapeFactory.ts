import EditorError from '../../../error/EditorError';
import type { AttributeValue } from '../attribute/AttributeSpec';
import Circle from './Circle';
import Ellipse from './Ellipse';
import Group from './Group';
import Line from './Line';
import Rect from './Rect';
import type Shape from './Shape';
import Text from './Text';

/** 可注册的图形类：静态部分即定义，构造函数即工厂。 */
export type ShapeClass = Pick<typeof Shape, 'type' | 'params' | 'paint' | 'attributes' | 'attribute'> &
  (new (id: string, values?: ReadonlyMap<string, AttributeValue>) => Shape);

/**
 * 图形工厂：类型名 → 图形类的注册表，构造时注册 6 种内置图形；后续插件类型向同一工厂注册。
 *
 * 待重构：按名分派是课程允许的两处之一（图形工厂），见 doc/update/20261020_FEAT_SHAPE_CREATE_DELETE.md。
 */
export default class ShapeFactory {
  private readonly classes = new Map<string, ShapeClass>();

  constructor() {
    for (const cls of [Rect, Circle, Ellipse, Line, Text, Group]) {
      this.register(cls);
    }
  }

  /** 注册图形类；类型名缺失或重名属于程序缺陷。 */
  register(cls: ShapeClass): void {
    if (!cls.type) {
      throw new Error('shape class must declare static type');
    }
    if (this.classes.has(cls.type)) {
      throw new Error(`duplicate shape type: ${cls.type}`);
    }
    this.classes.set(cls.type, cls);
  }

  /** 按类型名取图形类，未注册时报错。 */
  lookup(type: string): ShapeClass {
    const cls = this.classes.get(type);
    if (cls === undefined) {
      throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return cls;
  }
}
