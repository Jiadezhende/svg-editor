import { describe, expect, it, vi } from 'vitest';
import { Shape, ShapeFactory, SvgReader } from '../../../../src/backend';
import type { ShapeParseResult } from '../../../../src/backend';
import { Caption, Frame, Panel } from '../../../support/SvgCompositeExtension';

function factory(installed = true) {
  // 测试部件需由公共入口定义的类构造，使用相同 SVG 标签。
  const registry = new ShapeFactory();
  registry.register(Frame);
  registry.register(Caption);
  class Group extends Shape {
    static override readonly type = 'g';
    override acceptsChildren(): boolean { return true; }
    override move(): void {}
    override scale(): void {}
  }
  registry.register(Group);
  if (installed) registry.register(Panel);
  return registry;
}

const parts = '<rect id="p-frame" x="10" y="20" width="30" height="40"/><text id="p-caption" x="12" y="24">hello &amp; world</text>';
const svg = (body: string) => `<svg width="100" height="100">${body}</svg>`;
const panel = (body = parts) => `<g id="p" data-kind="test-panel">${body}</g>`;

describe('SvgReader 复合数据构造', () => {
  it('识别 data-kind 并消费私有部件，内部对象不成为节点，也不影响普通 g', () => {
    const { document, warnings } = new SvgReader(factory()).read(svg(`<g id="outer">${panel()}</g>`));
    const model = document.requireNode('p').value as Panel;
    expect(model).toBeInstanceOf(Panel);
    expect(model.frameShape()).toBeInstanceOf(Frame);
    expect(model.captionShape().value('text')).toBe('hello & world');
    expect(document.nodes().map((node) => node.value.id())).toEqual(['outer', 'p']);
    expect(document.requireNode('p').children()).toEqual([]);
    expect(document.findNode('p-frame')).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('未安装类型按原 g 降级，保留其普通节点子树', () => {
    const { document } = new SvgReader(factory(false)).read(svg(panel()));
    expect(document.requireNode('p').value).not.toBeInstanceOf(Panel);
    expect(document.nodes().map((node) => node.value.id())).toEqual(['p', 'p-frame', 'p-caption']);
  });

  it.each(['', '<text id="p-frame"/><text id="p-caption"/>', '<rect id="p-frame"/>'])('已安装但必要部件不合法时拒绝，不降级：%s', (body) => {
    expect(() => new SvgReader(factory()).read(svg(panel(body)))).toThrow('invalid panel parts: p');
  });

  it('消费内部部件后保留其余成员及嵌套文档关系', () => {
    const { document } = new SvgReader(factory()).read(svg(panel(`${parts}<g id="members"><rect id="child"/></g>`)));
    expect(document.nodes().map((node) => node.value.id())).toEqual(['p', 'members', 'child']);
    expect(document.requireNode('members').parent()).toBe(document.requireNode('p'));
    expect(document.requireNode('child').parent()).toBe(document.requireNode('members'));
  });

  it('允许嵌套复合类型作为文档成员', () => {
    const nested = panel().replaceAll('id="p', 'id="nested');
    const { document } = new SvgReader(factory()).read(svg(panel(parts + nested)));
    expect(document.nodes().map((node) => node.value.id())).toEqual(['p', 'nested']);
    expect(document.requireNode('nested').value).toBeInstanceOf(Panel);
  });

  it.each([
    [panel() + '<rect id="p-frame"/>', 'id already exists: p-frame'],
    [panel(parts + '<rect id="p-caption"/>'), 'id already exists: p-caption'],
    ['<defs><rect id="a"/></defs><rect id="a"/>', 'id already exists: a'],
    ['<defs><rect id="1bad"/></defs>', 'invalid id: 1bad'],
  ])('检查所有输入 id，包含私有部件和跳过的子树', (body, message) => {
    expect(() => new SvgReader(factory()).read(svg(body))).toThrow(message);
  });

  it('为缺失 id 补号时避开私有部件和根 id', () => {
    const { document, warnings } = new SvgReader(factory()).read(`<svg id="rect1">${panel()}<rect/></svg>`);
    expect(document.requireNode('rect2').value).toBeInstanceOf(Frame);
    expect(warnings).toEqual(['assigned id rect2 to unnamed <rect>']);
  });

  it('模型重复请求子 Shape 时只解析一次并保留相同引用', () => {
    class Cached extends Panel {
      static override readonly type = 'cached-panel';
      static override parse(id: string, attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
        expect(readChildren()[0]).toBe(readChildren()[0]);
        return super.parse(id, attributes, readChildren);
      }
    }
    const registry = factory();
    registry.register(Cached);
    const parse = vi.spyOn(registry, 'parse');
    new SvgReader(registry).read(svg(panel().replace('test-panel', 'cached-panel')));
    expect(parse).toHaveBeenCalledTimes(3);
  });

  it.each(['duplicate', 'foreign', 'wrong-id'])('拒绝解析契约无效的结果：%s', (mode) => {
    class Invalid extends Shape {
      static override readonly type = 'invalid';
      override move(): void {}
      override scale(): void {}
      static override parse(id: string, _attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
        const children = readChildren();
        return { shape: new Invalid(mode === 'wrong-id' ? 'different' : id), children: mode === 'duplicate' ? [children[0], children[0]] : [new Invalid('foreign')] };
      }
    }
    const registry = factory();
    registry.register(Invalid);
    expect(() => new SvgReader(registry).read(svg('<invalid id="i"><rect id="r"/></invalid>'))).toThrow(mode === 'wrong-id' ? 'parsed shape id mismatch: i' : 'invalid parsed children: i');
  });

  it('不能消费仍带有文档关系的普通容器而静默丢弃其后代', () => {
    class Drop extends Shape {
      static override readonly type = 'drop';
      override move(): void {}
      override scale(): void {}
      static override parse(id: string, _attributes: ReadonlyMap<string, string>, readChildren: () => readonly Shape[]): ShapeParseResult {
        readChildren();
        return { shape: new Drop(id), children: [] };
      }
    }
    const registry = factory();
    registry.register(Drop);
    expect(() => new SvgReader(registry).read(svg('<drop id="d"><g id="nested"><rect id="r"/></g></drop>'))).toThrow('internal part has document children: nested');
  });
});
