import { createReceiver } from '../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import Rect from '../../../../plugins/core/Rect';
import Document from '../../../../src/backend/receiver/document/Document';
import Shape from '../../../../src/backend/receiver/document/shape/Shape';
import type { SvgElement } from '../../../../src/backend/receiver/document/shape/SvgElement';
import SvgWriter from '../../../../src/backend/receiver/svg/SvgWriter';
import CompositeShape from '../../../support/CompositeShape';
import { Panel } from '../../../support/SvgCompositeExtension';

async function documentWith(width: number, height: number, ...lines: string[][]): Promise<Document> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(width, height));
  for (const args of lines) {
    new CreateCommand(receiver, args).execute();
  }
  return receiver.document();
}

class PayloadShape extends Shape {
  static override readonly type = 'box';

  constructor(private readonly payload: SvgElement) {
    super('p');
  }

  override element(): string { return 'g'; }
  override move(): void {}
  override scale(): void {}
  override toSvg(): SvgElement { return this.payload; }
}

class MissingPart extends CompositeShape {
  override toSvg(): SvgElement {
    return { type: 'g', attributes: [['id', 'p']], children: [this.frameShape().toSvg()] };
  }
}

describe('SvgWriter', () => {
  it('与接口契约的文件格式示例逐字一致', async () => {
    const doc = (await documentWith(
      400,
      200,
      ['g', 'flow'],
      ['rect', 'start', '30', '70', '120', '60', '#4a90d9', 'in', 'flow'],
      ['line', 'edge', '150', '100', '250', '100', 'black', 'in', 'flow'],
      ['rect', 'end', '250', '70', '120', '60', '#f5a623', 'in', 'flow'],
    ));
    expect(new SvgWriter().write(doc)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <g id="flow">',
        '    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>',
        '    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>',
        '    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('text 的内容写成子文本；中文与 < & 正确转义', async () => {
    const doc = (await documentWith(100, 100, ['text', 't1', '20', '40', '开始 <a> & "b"']));
    expect(new SvgWriter().write(doc)).toContain('  <text id="t1" x="20" y="40">开始 &lt;a&gt; &amp; "b"</text>');
  });

  it('属性值中的特殊字符转义', async () => {
    const doc = (await documentWith(100, 100, ['rect', 'r1', '0', '0', '1', '1', 'url("#a")&b']));
    expect(new SvgWriter().write(doc)).toContain('fill="url(&quot;#a&quot;)&amp;b"');
  });

  it('空容器自闭合；空文档的 svg 根自闭合', async () => {
    expect(new SvgWriter().write((await documentWith(100, 100, ['g', 'scene'])))).toContain('  <g id="scene"/>');
    expect(new SvgWriter().write((await documentWith(800, 600)))).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"/>\n',
    );
  });

  it('数值按数值格式写出；viewBox 写出文档自身的 viewBox', async () => {
    const doc = new Document(100.5, 50, [0, 0, 201, 100]);
    expect(new SvgWriter().write(doc)).toContain('width="100.5" height="50" viewBox="0 0 201 100"');
    const shapes = (await documentWith(100, 100, ['circle', 'c1', '0.1', '0.2', '1']));
    shapes.requireNode('c1').value.move(0.2, 0);
    expect(new SvgWriter().write(shapes)).toContain('<circle id="c1" cx="0.3" cy="0.2" r="1"/>');
  });

  it('外观属性按 fill、stroke、stroke-width 顺序写在几何属性之后', async () => {
    const doc = (await documentWith(100, 100, ['circle', 'c1', '1', '2', '3']));
    const circle = doc.requireNode('c1').value;
    circle.set('stroke-width', '2');
    circle.set('fill', 'red');
    circle.set('stroke', 'black');
    expect(new SvgWriter().write(doc)).toContain(
      '<circle id="c1" cx="1" cy="2" r="3" fill="red" stroke="black" stroke-width="2"/>',
    );
  });
});


describe('SvgWriter 多态写出', () => {
  it('模型自身与私有部件在前，文档成员按原顺序追加', () => {
    const doc = new Document(100, 100);
    const panel = new Panel('p');
    const node = doc.insert(panel);
    doc.insert(new Rect('child', new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]])), node);
    expect(new SvgWriter().write(doc)).toContain(
      '  <g id="p" data-kind="test-panel">\n' +
      '    <rect id="p-frame" x="1" y="2" width="20" height="10"/>\n' +
      '    <text id="p-caption" x="3" y="4">hello</text>\n' +
      '    <rect id="child" x="0" y="0" width="1" height="1"/>\n' +
      '  </g>',
    );
  });

  it('元素名、data-kind 与声明 id 在写文件前校验', () => {
    const mismatch = new Document(100, 100);
    mismatch.insert(new PayloadShape({ type: 'rect', attributes: [['id', 'p'], ['data-kind', 'box']] }));
    expect(() => new SvgWriter().write(mismatch)).toThrow('SVG element mismatch: p');

    const kind = new Document(100, 100);
    kind.insert(new PayloadShape({ type: 'g', attributes: [['id', 'p']] }));
    expect(() => new SvgWriter().write(kind)).toThrow('missing data-kind: p');

    const missing = new Document(100, 100);
    missing.insert(new MissingPart('p'));
    expect(() => new SvgWriter().write(missing)).toThrow('missing SVG element id: p-label');
  });
});
