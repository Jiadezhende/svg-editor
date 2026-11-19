import type Shape from '../receiver/document/shape/Shape';

/** 静态 Handler 类的公开契约；注册类本身，不创建实例。 */
export default interface AttributeHandler {
  readonly handlerName: string;

  /** 只读判断目标模型、属性名及别名是否适用。 */
  matches(shape: Shape, key: string): boolean;

  /** 通过模型公开方法修改目标及其封装部件。 */
  apply(shape: Shape, key: string, token: string): void;

  /** 只读返回领域属性的展示值；null 表示未设置，不触发默认回退。 */
  display(shape: Shape, key: string): string | null;
}
