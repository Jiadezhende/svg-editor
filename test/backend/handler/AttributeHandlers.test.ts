import { describe, expect, it, vi } from 'vitest';
import { AttributeHandlers, Shape } from '../../../src/backend';
import type { AttributeHandler } from '../../../src/backend';

class Marker extends Shape {
  static override readonly type = 'marker';
}

function handler(name: string, matches: boolean) {
  return class {
    static readonly handlerName = name;
    static readonly matches = vi.fn((_shape: Shape, _key: string) => matches);
    static readonly apply = vi.fn((_shape: Shape, _key: string, _token: string) => {});
    static readonly display = vi.fn((_shape: Shape, _key: string): string | null => null);

    constructor() { throw new Error('must not instantiate'); }
  };
}

describe('AttributeHandlers', () => {
  it('空表返回 null，静态类直接注册和返回，不创建实例', () => {
    const registry = new AttributeHandlers();
    const shape = new Marker('m');
    expect(registry.resolve(shape, 'label')).toBeNull();
    const Handler = handler('marker-label', true);
    registry.register(Handler);
    expect(registry.resolve(shape, 'label')).toBe(Handler);
    expect(Handler.matches).toHaveBeenCalledWith(shape, 'label');
    expect(Handler.apply).not.toHaveBeenCalled();
    expect(Handler.display).not.toHaveBeenCalled();
  });

  it('按顺序跳过未命中项，首次命中后不再匹配后续项', () => {
    const registry = new AttributeHandlers();
    const skipped = handler('skipped', false);
    const first = handler('first', true);
    const later = handler('later', true);
    for (const entry of [skipped, first, later]) registry.register(entry);
    expect(registry.resolve(new Marker('m'), 'alias')).toBe(first);
    expect(skipped.matches).toHaveBeenCalledOnce();
    expect(first.matches).toHaveBeenCalledOnce();
    expect(later.matches).not.toHaveBeenCalled();
  });

  it('允许匹配范围重叠，交换注册顺序改变胜出者，注册表相互独立', () => {
    const first = handler('first', true);
    const second = handler('second', true);
    const forward = new AttributeHandlers();
    const reverse = new AttributeHandlers();
    forward.register(first);
    forward.register(second);
    reverse.register(second);
    reverse.register(first);
    const shape = new Marker('m');
    expect(forward.resolve(shape, 'fill')).toBe(first);
    expect(reverse.resolve(shape, 'fill')).toBe(second);
    expect(new AttributeHandlers().resolve(shape, 'fill')).toBeNull();
  });

  it('全部未命中返回 null', () => {
    const registry = new AttributeHandlers();
    registry.register(handler('skipped', false));
    expect(registry.resolve(new Marker('m'), 'fill')).toBeNull();
  });

  it('同类或不同类的同名注册均拒绝，保留原注册项', () => {
    const registry = new AttributeHandlers();
    const first = handler('same', true);
    registry.register(first);
    expect(() => registry.register(first)).toThrow('duplicate attribute handler: same');
    expect(() => registry.register(handler('same', true))).toThrow('duplicate attribute handler: same');
    expect(registry.resolve(new Marker('m'), 'fill')).toBe(first);
  });

  it('拒绝实例、空名及缺失静态方法的声明，失败不污染注册表', () => {
    const registry = new AttributeHandlers();
    for (const invalid of [
      null,
      {},
      new (class { readonly handlerName = 'bad'; matches() {}; apply() {}; display() {} })(),
      handler('  ', true),
      class { static readonly handlerName = 'bad'; },
      class { static readonly handlerName = 'bad'; static matches() {}; static apply() {} },
      class { static readonly handlerName = 'bad'; static matches() {}; static display() {} },
      class { static readonly handlerName = 'bad'; static apply() {}; static display() {} },
    ]) {
      expect(() => registry.register(invalid as unknown as AttributeHandler)).toThrow('attribute handler must be a static class');
    }
    const valid = handler('bad', true);
    registry.register(valid);
    expect(registry.resolve(new Marker('m'), 'fill')).toBe(valid);
  });

  it('matches 抛错直接传播，不继续匹配', () => {
    const registry = new AttributeHandlers();
    const broken = handler('broken', false);
    broken.matches.mockImplementation(() => { throw new Error('match failed'); });
    const later = handler('later', true);
    registry.register(broken);
    registry.register(later);
    expect(() => registry.resolve(new Marker('m'), 'fill')).toThrow('match failed');
    expect(later.matches).not.toHaveBeenCalled();
  });
});
