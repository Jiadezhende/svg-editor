import type Shape from './Shape';
import type AttributeHandler from './AttributeHandler';

/** 有序静态 Handler 注册表；匹配规则完全由 Handler 提供。 */
export default class AttributeHandlerRegistry {
  private readonly handlers = new Map<string, AttributeHandler>();

  register(handler: AttributeHandler): void {
    // 类本身也继承 Function.apply，不能将它误认为领域操作的实现。
    if (typeof (handler as unknown) !== 'function' ||
        typeof handler.handlerName !== 'string' || !handler.handlerName.trim() ||
        typeof handler.matches !== 'function' || typeof handler.apply !== 'function' ||
        handler.apply === (Function.prototype.apply as unknown) ||
        typeof handler.display !== 'function') {
      throw new Error('attribute handler must be a static class with handlerName, matches, apply and display');
    }
    if (this.handlers.has(handler.handlerName)) {
      throw new Error(`duplicate attribute handler: ${handler.handlerName}`);
    }
    this.handlers.set(handler.handlerName, handler);
  }

  /** 注册顺序即优先级；首次命中后停止，零命中才交给模型默认规则。 */
  resolve(shape: Shape, key: string): AttributeHandler | null {
    for (const handler of this.handlers.values()) {
      if (handler.matches(shape, key)) return handler;
    }
    return null;
  }
}
