import EditorError from '../../../error/EditorError';
import Shape from './Shape';
import type { ShapeParseResult } from './Shape';

/** 图形类型注册契约：静态声明、解析能力与“只接收 id”的候选构造。 */
export type ShapeModel = Pick<
  typeof Shape,
  'prototype' | 'type' | 'params' | 'createParams' | 'paint' | 'anchor' | 'content' | 'attributes' | 'attribute' | 'parse' | 'checkId'
> & (abstract new (id: string) => Shape);

/**
 * 图形工厂：内部保存类型名 → 图形类，使用侧查询规格并由工厂创建实例。
 * 初始注册表为空，具体类型由宿主选择并注册。
 * 使用侧只查询规格与创建实例，具体类的选择和注册留在宿主。
 */
export default class ShapeFactory {
  private readonly classes = new Map<string, ShapeModel>();

  /** 注册 Shape 子类，并校验其解析方法、类型名和锚点。 */
  register(cls: ShapeModel): void {
    if (typeof cls !== 'function' || !(cls.prototype instanceof Shape) || typeof cls.parse !== 'function') {
      throw new Error('shape must extend Shape and provide parse');
    }
    if (!cls.type) {
      throw new Error('shape class must declare static type');
    }
    if (this.classes.has(cls.type)) {
      throw new Error(`duplicate shape type: ${cls.type}`);
    }
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

  /** 按类型和 id 构造候选；完整性由创建流程在写入全部属性后校验。 */
  create(type: string, id: string): Shape {
    // typeof Shape 带有抽象构造签名，注册表保存的是已校验的子类。
    return Reflect.construct(this.lookup(type), [id]) as Shape;
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

  /** 构造函数只在注册表内部查找，未知类型保持原错误语义。 */
  private lookup(type: string): ShapeModel {
    const cls = this.classes.get(type);
    if (cls === undefined) {
      throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return cls;
  }
}
