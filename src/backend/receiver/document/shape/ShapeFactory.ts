import EditorError from '../../../error/EditorError';
import type { AttributeValue } from './attribute/AttributeSpec';
import Shape from './Shape';
import type { ShapeParseResult } from './Shape';

/**
 * 图形工厂：内部保存类型名 → 图形类，使用侧查询规格并由工厂创建实例。
 * 初始注册表为空，具体类型由宿主选择并注册。
 * 使用侧只查询规格与创建实例，具体类的选择和注册留在宿主。
 */
export default class ShapeFactory {
  private readonly classes = new Map<string, typeof Shape>();

  /** 注册 Shape 子类，并校验其解析方法、类型名和锚点。 */
  register(cls: typeof Shape): void {
    if (typeof cls !== 'function' || !(cls.prototype instanceof Shape) || typeof cls.parse !== 'function') {
      throw new Error('shape must extend Shape and provide parse');
    }
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
    typeof Shape, 'type' | 'params' | 'createParams' | 'paint' | 'content' | 'attributes' | 'attribute'
  >> {
    return this.lookup(type);
  }

  /** 统一创建入口；属性与自身结构的有效性由具体模型保证。 */
  create(type: string, id: string, values: ReadonlyMap<string, AttributeValue> = new Map()): Shape {
    // typeof Shape 带有抽象构造签名，注册表保存的是已校验的子类。
    return Reflect.construct(this.lookup(type), [id, values]) as Shape;
  }

  /** 调用已注册类的数据构造能力；递归函数由读入编排者提供。 */
  parse(
    type: string,
    id: string,
    attributes: ReadonlyMap<string, string>,
    readChildren: () => readonly Shape[] = () => [],
  ): ShapeParseResult {
    return this.lookup(type).parse(id, attributes, readChildren);
  }

  private static checkAnchor(cls: typeof Shape): void {
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
  private lookup(type: string): typeof Shape {
    const cls = this.classes.get(type);
    if (cls === undefined) {
      throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return cls;
  }
}
