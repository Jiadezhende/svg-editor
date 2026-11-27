import { describe, expect, it } from 'vitest';
import { Document, Shape, TreeRenderer } from '../../src/backend';
import activate, { ModifiedStar } from '../../plugins/modified-star/index';

class Leaf extends Shape {
  static override readonly type = 'leaf';
  override move(): void {}
  override scale(): void {}
}
class Group extends Shape {
  static override readonly type = 'g';
  override acceptsChildren(): boolean { return true; }
  override move(): void {}
  override scale(): void {}
}

describe('modified-star 插件', () => {
  it('新增、保存、编辑和撤销按内容比较，子图形属性不标记父行', () => {
    expect(activate().decorators).toEqual([ModifiedStar]);
    const renderer = new TreeRenderer([ModifiedStar]);
    const other = new TreeRenderer([ModifiedStar]);
    const document = new Document(20, 30);
    renderer.notify('replace', document);
    const parent = document.insert(new Group('group'));
    const leaf = new Leaf('leaf');
    const node = document.insert(leaf, parent);
    renderer.notify('edit', document);
    expect(renderer.render(document)).toEqual(['svg (20x30) *', '└── g#group *', '    └── leaf#leaf *']);
    expect(other.render(document)).toEqual(['svg (20x30)', '└── g#group', '    └── leaf#leaf']);

    renderer.notify('save', document);
    const clean = renderer.render(document);
    const before = leaf.capture();
    leaf.set('fill', 'red');
    renderer.notify('edit', document);
    expect(renderer.render(document)).toEqual(['svg (20x30) *', '└── g#group', '    └── leaf#leaf *']);

    before.restore();
    renderer.notify('undo', document);
    expect(renderer.render(document)).toEqual(clean);
    leaf.set('fill', 'red');
    renderer.notify('redo', document);
    expect(renderer.render(document, node)).toEqual(['leaf#leaf *']);

    document.remove(node);
    renderer.notify('edit', document);
    expect(renderer.render(document)).toEqual(['svg (20x30) *', '└── g#group *']);
    renderer.notify('replace', document);
    expect(renderer.render(document)).toEqual(['svg (20x30)', '└── g#group']);
    document.resize(30, 40);
    renderer.notify('edit', document);
    expect(renderer.render(document)).toEqual(['svg (30x40) *', '└── g#group']);
  });
});
