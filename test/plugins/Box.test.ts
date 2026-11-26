import { describe, expect, it } from 'vitest';
import {
  AttributeHandlerRegistry, CoordinateAttribute, Document, LengthAttribute, Shape, ShapeFactory, SvgReader, SvgWriter, TextAttribute, TreeRenderer,
} from '../../src/backend';
import Box from '../../plugins/box/Box';
import activate from '../../plugins/box/index';

class Rect extends Shape {
  static override readonly type = 'rect';
  static override readonly params = [
    new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new LengthAttribute('width'), new LengthAttribute('height'),
  ];

  override move(): void {}
  override scale(): void {}
}
class Text extends Shape {
  static override readonly type = 'text';
  static override readonly params = [new CoordinateAttribute('x', 'x'), new CoordinateAttribute('y', 'y'), new TextAttribute('text')];
  static override readonly content = 'text';

  override move(): void {}
  override scale(): void {}
}
class Group extends Shape {
  static override readonly type = 'g';
  override acceptsChildren(): boolean { return true; }
  override move(): void {}
  override scale(): void {}
}

function factory(boxInstalled: boolean): ShapeFactory {
  const result = new ShapeFactory();
  for (const model of [Rect, Text, Group]) result.register(model);
  if (boxInstalled) result.register(activate().shapes[0].model);
  return result;
}

/** 用插件的 Handler 写入几何与标题，等价于 create box 的写入序列。 */
function box(id: string): Box {
  const shape = new Box(id);
  const handler = activate().attributes[0];
  const values: ReadonlyArray<readonly [string, string]> = [
    ['x', '120'], ['y', '100'], ['width', '160'], ['height', '60'], ['label', '开始'],
  ];
  for (const [key, token] of values) handler.apply(shape, key, token);
  shape.validate();
  return shape;
}

describe('box 插件', () => {
  it('独立构造有效部件、视图和固定 id，并保持文档查询边界', () => {
    const document = new Document(800, 600);
    const shape = box('n1');
    const node = document.insert(shape);
    document.insert(box('n2'), node);
    expect(shape.identifiers()).toEqual(['n1', 'n1-rect', 'n1-label']);
    expect(shape.value('fill')).toBeNull();
    expect(shape.frameShape().value('fill')).toBe('#4a90d9');
    expect(shape.view().children).toMatchObject([{ id: 'n1-rect' }, { id: 'n1-label', content: '开始' }]);
    expect(Object.isFrozen(shape.view().children[0].attributes[0])).toBe(true);
    expect(document.elementCount()).toBe(6);
    expect(document.findNode('n1-label')).toBeNull();
    expect(() => document.requireNode('n1-rect')).toThrow('no such shape: n1-rect');
    expect(() => document.insert(new Rect('n1-rect', new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]]))))
      .toThrow('id already exists: n1-rect');
    expect(() => shape.checkUngroup()).toThrow('cannot ungroup composite shape: n1');
    const renderer = new TreeRenderer(activate().decorators);
    expect(renderer.render(document, node)).toEqual([
      'g#n1 (box)',
      '├── rect#n1-rect  x=120 y=100 width=160 height=60',
      '├── text#n1-label  x=140 y=135 text="开始"',
      '└── g#n2 (box)',
      '    ├── rect#n2-rect  x=120 y=100 width=160 height=60',
      '    └── text#n2-label  x=140 y=135 text="开始"',
    ]);
  });

  it('处理器分别编辑两个部件，属性快照恢复完整复合模型', () => {
    const registry = new AttributeHandlerRegistry();
    registry.register(activate().attributes[0]);
    const shape = box('n');
    const fill = registry.resolve(shape, 'fill')!;
    const label = registry.resolve(shape, 'label')!;
    const initial = shape.capture();
    fill.apply(shape, 'fill', '#f5a623');
    const painted = shape.capture();
    label.apply(shape, 'label', '处理数据 v2');
    expect(fill.display(shape, 'fill')).toBe('#f5a623');
    expect(label.display(shape, 'label')).toBe('"处理数据 v2"');
    expect(shape.value('fill')).toBeNull();
    painted.restore();
    expect(shape.captionShape().display('text')).toBe('"开始"');
    expect(shape.frameShape().display('fill')).toBe('#f5a623');
    initial.restore();
    expect(shape.frameShape().display('fill')).toBe('#4a90d9');
    expect(registry.resolve(shape, 'stroke')).not.toBeNull();
  });

  it('移动和缩放复合模型及其文档成员，数值错误恢复已经修改的私有部件', () => {
    const document = new Document(10, 10);
    const node = document.insert(box('n'));
    document.insert(box('child'), node);
    const initial = document.capture(node);
    document.move(node, 0, 100);
    document.scale(node, 2);
    const views = document.shapeViews(node)[0].children;
    expect(views[0].attributes).toContainEqual(['y', 400]);
    expect(views[2].children[1].attributes).toContainEqual(['y', 470]);
    initial.restore();
    expect(document.shapeViews(node)[0].children[2].children[1].attributes).toContainEqual(['y', 135]);

    const xml = '<svg><g id="n" data-kind="box"><rect id="n-rect"/><text id="n-label" x="160' +
      '0'.repeat(306) + '">title</text></g></svg>';
    const restored = new SvgReader(factory(true)).read(xml).document;
    const before = restored.shapeViews();
    expect(() => restored.move(restored.requireNode('n'), 1e308, 0)).toThrow('finite');
    expect(restored.shapeViews()).toEqual(before);
  });

  it('用独立部件替身验证保存、恢复、嵌套和卸载降级', () => {
    const document = new Document(800, 600);
    const shape = box('n');
    const parent = document.insert(shape);
    shape.captionShape().set('text', 'a & b');
    document.insert(box('child'), parent);
    const writer = new SvgWriter([activate().shapes[0].mapping!]);
    const svg = writer.write(document);
    expect(svg).toContain('<g id="n" data-kind="box">');
    expect(svg).toContain('a &amp; b');
    const restored = new SvgReader(factory(true)).read(svg).document;
    expect(restored.requireNode('n').value).toBeInstanceOf(Box);
    expect(restored.requireNode('child').parent()?.value.id()).toBe('n');
    expect(restored.findNode('n-rect')).toBeNull();
    expect(writer.write(restored)).toBe(svg);
    const fallback = new SvgReader(factory(false)).read(svg).document;
    expect(fallback.requireNode('n').value.type()).toBe('g');
    expect(fallback.requireNode('n-rect').parent()?.value.id()).toBe('n');
    expect(fallback.requireNode('child-label').value.content()).toBe('开始');
  });

  it.each([
    ['<rect id="n-rect"/>', 'invalid box parts: n'],
    ['<g id="n-rect"/><text id="n-label"/>', 'invalid box parts: n'],
    ['<rect id="n-rect"/><text id="n-label"/><g id="n-rect"/>', 'id already exists: n-rect'],
  ])('拒绝损坏的 box XML', (children, message) => {
    const xml = `<svg><g id="n" data-kind="box">${children}</g></svg>`;
    expect(() => new SvgReader(factory(true)).read(xml)).toThrow(message);
  });
});
