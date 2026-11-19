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
type ShapeClass = Pick<
  typeof Shape,
  'type' | 'params' | 'paint' | 'anchor' | 'content' | 'attributes' | 'attribute'
> &
  (new (id: string, values?: ReadonlyMap<string, AttributeValue>) => Shape);

/**
 * 图形工厂：内部保存类型名 → 图形类，使用侧查询规格并由工厂创建实例。
 * 当前构造时注册 6 种内置图形，第三批后续将具体类型装配迁至宿主。
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

  /** 注册图形类；类型名缺失、重名、锚点不是本类的 x / y 坐标属性，都属于程序缺陷。 */
  register(cls: ShapeClass): void {
    if (!cls.type) {
      throw new Error('shape class must declare static type');
    }
    if (this.classes.has(cls.type)) {
      throw new Error(`duplicate shape type: ${cls.type}`);
    }
    ShapeFactory.checkAnchor(cls);
    this.classes.set(cls.type, cls);
  }

  /** 是否支持该类型；不构造对象，供读入流程决定是否跳过。 */
  has(type: string): boolean {
    return this.classes.has(type);
  }

  /** 已注册类的只读规格视图，不暴露构造签名或注册校验信息。 */
  definition(type: string): Readonly<Pick<
    ShapeClass, 'type' | 'params' | 'paint' | 'content' | 'attributes' | 'attribute'
  >> {
    return this.lookup(type);
  }

  /** 统一创建入口；属性与自身结构的有效性由具体模型保证。 */
  create(type: string, id: string, values: ReadonlyMap<string, AttributeValue> = new Map()): Shape {
    const cls = this.lookup(type);
    return new cls(id, values);
  }

  private static checkAnchor(cls: ShapeClass): void {
    const anchor = cls.anchor;
    if (anchor === null) {
      return;
    }
    (['x', 'y'] as const).forEach((axis, i) => {
      if (cls.attribute(anchor[i])?.axis() !== axis) {
        throw new Error(`${cls.type} anchor ${anchor[i]} must be a ${axis} coordinate`);
      }
    });
  }

  /** 构造函数只在注册表内部查找，未知类型保持原错误语义。 */
  private lookup(type: string): ShapeClass {
    const cls = this.classes.get(type);
    if (cls === undefined) {
      throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return cls;
  }
}
