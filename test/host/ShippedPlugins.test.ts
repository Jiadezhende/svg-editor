import { describe, expect, it } from 'vitest';
import { createClient, createShapeFactory, createHost } from '../support/Plugins';

describe('宿主默认装配', () => {
  it('每次装配独立的工厂和会话，默认能力不会泄漏到其他实例', async () => {
    const first = await createHost();
    const second = await createHost();
    expect(first.receiver).not.toBe(second.receiver);
    expect(first.factory).not.toBe(second.factory);
    expect(first.handlers).not.toBe(second.handlers);
    expect(first.handlers.resolve(first.factory.create('g', 'group'), 'fill')).toBeNull();
    first.client.execute(['init']);
    second.client.execute(['init']);
    first.client.execute(['create', 'g', 'first']);
    second.client.execute(['create', 'g', 'second']);
    first.client.execute(['undo']);
    expect(first.receiver.document().children()).toHaveLength(0);
    expect(second.receiver.document().children().map((node) => node.value.id())).toEqual(['second']);
    for (const type of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) {
      expect((await createShapeFactory()).has(type)).toBe(true);
    }
  });

  it('默认命令顺序与原文件名排序一致，并能执行真实分组与撤销', async () => {
    const client = (await createClient());
    const help = client.execute(['help']).lines();
    expect(help.slice(0, 4)).toEqual(['addto <gid> <id>', 'back <id>', 'canvas <w> <h>', 'canvas']);
    expect(help).toEqual((await createClient()).execute(['help']).lines());
    client.execute(['init']);
    client.execute(['create', 'rect', 'r', '0', '0', '1', '1']);
    expect(client.execute(['group', 'g', 'r']).lines()).toEqual(['g#g created with 1 children']);
    expect(client.execute(['undo']).lines()).toEqual(['g#g removed, 1 children restored']);
    expect(client.execute(['redo']).lines()).toEqual(['g#g created with 1 children']);
  });
});
