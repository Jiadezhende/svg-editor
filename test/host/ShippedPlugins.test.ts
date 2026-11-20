import { describe, expect, it } from 'vitest';
import { createClient, createShapeFactory, createWorkspace } from '../support/Plugins';

describe('宿主默认装配', () => {
  it('每次装配独立的工厂和会话，默认能力不会泄漏到其他实例', async () => {
    const first = (await createWorkspace());
    const second = (await createWorkspace());
    expect(first).not.toBe(second);
    expect(first.shapes()).not.toBe(second.shapes());
    expect(first.attributeHandlerRegistry()).not.toBe(second.attributeHandlerRegistry());
    expect(first.attributeHandlerRegistry().resolve(first.shapes().create('g', 'group'), 'fill')).toBeNull();
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
