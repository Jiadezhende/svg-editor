import { describe, expect, it } from 'vitest';
import TreeCommand from '../../../../src/backend/command/impl/TreeCommand';
import CreateCommand from '../../../../src/backend/command/impl/CreateCommand';
import EditorError from '../../../../src/backend/error/EditorError';
import Document from '../../../../src/backend/receiver/document/Document';
import ShapeFactory from '../../../../src/backend/receiver/document/shape/ShapeFactory';
import SvgReader from '../../../../src/backend/receiver/svg/SvgReader';
import SvgWriter from '../../../../src/backend/receiver/svg/SvgWriter';
import Workspace from '../../../../src/backend/receiver/workspace/Workspace';

function read(text: string) {
  return new SvgReader(new ShapeFactory()).read(text);
}

function tree(doc: Document): string[] {
  const workspace = new Workspace();
  workspace.replace(doc);
  return [...new TreeCommand(workspace, []).execute().lines()];
}

function svg(body: string, root = 'width="400" height="300" viewBox="0 0 400 300"'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${root}>\n${body}\n</svg>\n`;
}

const other = svg(`  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>`);

describe('SvgReader', () => {
  it('读入接口契约中的 other.svg：为缺 id 的 rect 补 id 并警告，结构与示例一致', () => {
    const { document, warnings } = read(other);
    expect(warnings).toEqual(['assigned id rect1 to unnamed <rect>']);
    expect(document.shapes()).toHaveLength(7);
    expect(tree(document)).toEqual([
      'svg (400x300)',
      '├── rect#rect1  x=0 y=0 width=400 height=300',
      '├── text#t1  x=10 y=290 text="imported"',
      '├── circle#c1  cx=50 cy=50 r=10',
      '├── g#g1',
      '│   ├── rect#r2  x=0 y=0 width=10 height=10',
      '│   └── circle#c2  cx=5 cy=5 r=2',
      '└── ellipse#e1  cx=1 cy=2 rx=3 ry=4',
    ]);
    expect(document.requireShape('rect1').value('fill')).toBe('#ffffff');
  });

  it('SvgWriter 写出的文件读回后 tree 一致，再次写出逐字相同', () => {
    const workspace = new Workspace();
    workspace.replace(new Document(400, 200));
    for (const args of [
      ['g', 'flow'],
      ['rect', 'start', '30', '70', '120', '60', '#4a90d9', 'in', 'flow'],
      ['text', 'label', '55', '105', '开始 <a> & "b"', 'in', 'flow'],
      ['g', 'scene'],
      ['line', 'edge', '150', '100', '250.5', '100', 'black'],
    ]) {
      new CreateCommand(workspace, args).execute();
    }
    workspace.document().requireShape('edge').set('stroke-width', '2');
    const written = new SvgWriter().write(workspace.document());
    const { document, warnings } = read(written);
    expect(warnings).toEqual([]);
    expect(tree(document)).toEqual(tree(workspace.document()));
    expect(document.requireShape('label').value('text')).toBe('开始 <a> & "b"');
    expect(new SvgWriter().write(document)).toBe(written);
  });

  it('补 id 跳过已占用的编号，按文档顺序分配', () => {
    const { document, warnings } = read(svg('<rect id="rect1" x="0" y="0" width="1" height="1"/><g><rect x="0" y="0" width="1" height="1"/></g><g/>'));
    expect(warnings).toEqual([
      'assigned id g1 to unnamed <g>',
      'assigned id rect2 to unnamed <rect>',
      'assigned id g2 to unnamed <g>',
    ]);
    expect(document.shapes().map((s) => s.id())).toEqual(['rect1', 'g1', 'rect2', 'g2']);
  });

  it('不支持的元素连同子树一起跳过并警告，不计入元素数', () => {
    const { document, warnings } = read(
      svg('<title>x</title><defs><rect id="hidden" x="0" y="0" width="1" height="1"/></defs><path d="M0 0"/><circle id="c" cx="0" cy="0" r="1"/>'),
    );
    expect(warnings).toEqual(['skipped unsupported <title>', 'skipped unsupported <defs>', 'skipped unsupported <path>']);
    expect(document.shapes().map((s) => s.id())).toEqual(['c']);
  });

  it('未知属性丢弃；缺少的必填属性取默认值', () => {
    const { document } = read(svg('<rect id="r" x="5" class="a" transform="scale(2)"/><text id="t" font-size="3"/>'));
    expect(tree(document)).toEqual([
      'svg (400x300)',
      '├── rect#r  x=5 y=0 width=0 height=0',
      '└── text#t  x=0 y=0 text=""',
    ]);
  });

  it('属性值两侧的空白被忽略', () => {
    const { document } = read(svg('<circle id="c" cx=" 1 " cy="2" r="3" fill=" red "/>'));
    expect(document.requireShape('c').value('cx')).toBe(1);
    expect(document.requireShape('c').value('fill')).toBe('red');
  });

  it.each([
    ['width="400" height="300"', [400, 300], [0, 0, 400, 300]],
    ['viewBox="0 0 640 480"', [640, 480], [0, 0, 640, 480]],
    ['width="100%" height="10px" viewBox="10 20 30 40"', [30, 40], [10, 20, 30, 40]],
    ['width="200"', [200, 600], [0, 0, 200, 600]],
    ['', [800, 600], [0, 0, 800, 600]],
    ['viewBox="0,0,50,60"', [50, 60], [0, 0, 50, 60]],
    ['width="300" height="200" viewBox="bad"', [300, 200], [0, 0, 300, 200]],
  ])('画布尺寸：%s', (root, size, viewBox) => {
    const { document } = read(svg('', root));
    expect([document.width(), document.height()]).toEqual(size);
    expect(document.viewBox()).toEqual(viewBox);
  });

  it.each([
    ['XML 非法', '<svg><rect></svg>', 'invalid svg: '],
    ['空文件', '', 'invalid svg: '],
    ['根不是 svg', '<html/>', 'invalid svg: root element is <html>, not <svg>'],
    ['几何属性不是数字', svg('<rect id="r" x="10px" y="0" width="1" height="1"/>'), 'not a number: 10px'],
    ['尺寸为负', svg('<circle id="c" cx="0" cy="0" r="-1"/>'), 'r must be non-negative'],
    ['id 不合法', svg('<rect id="1abc" x="0" y="0" width="1" height="1"/>'), 'invalid id: 1abc'],
    ['id 重复', svg('<g id="a"><rect id="a" x="0" y="0" width="1" height="1"/></g>'), 'id already exists: a'],
    ['画布尺寸非正数', svg('', 'width="0" height="10"'), 'canvas size must be positive'],
  ])('%s时报错', (_case, text, message) => {
    expect(() => read(text)).toThrow(EditorError);
    expect(() => read(text)).toThrow(message);
  });
});
