import type Client from './Client';
import type AttributeHandler from './handler/AttributeHandler';
import type ShapeFactory from './receiver/document/shape/ShapeFactory';
import type { SvgShapeMapping } from './receiver/svg/SvgWriter';
import type TreeRenderer from './tree/TreeRenderer';

/** 插件只声明贡献，无法取得当前会话或底层注册表。宿主验证成功后统一装配。 */
export interface ExtensionContext {
  registerShape(model: Parameters<ShapeFactory['register']>[0], mapping?: SvgShapeMapping): void;
  registerCommand(command: Parameters<Client['register']>[0]): void;
  registerAttributeHandler(handler: AttributeHandler): void;
  registerTreeDecorator(decorator: NonNullable<ConstructorParameters<typeof TreeRenderer>[0]>[number]): void;
}

export interface ExtensionPlugin {
  activate(context: ExtensionContext): void | Promise<void>;
}
