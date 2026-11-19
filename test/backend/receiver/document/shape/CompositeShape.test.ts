import { describe, expect, it } from 'vitest';
import CompositeShape from '../../../../support/CompositeShape';
import Shape from '../../../../../src/backend/receiver/document/shape/Shape';
import Group from '../../../../../src/backend/receiver/document/shape/Group';
import Rect from '../../../../../src/backend/receiver/document/shape/Rect';
import Document from '../../../../../src/backend/receiver/document/Document';
import Workspace from '../../../../../src/backend/receiver/workspace/Workspace';
import TreeCommand from '../../../../../src/backend/command/impl/TreeCommand';
import GroupCommand from '../../../../../src/backend/command/impl/GroupCommand';
import UngroupCommand from '../../../../../src/backend/command/impl/UngroupCommand';
import CreateCommand from '../../../../../src/backend/command/impl/CreateCommand';
import AddtoCommand from '../../../../../src/backend/command/impl/AddtoCommand';
import SvgWriter from '../../../../../src/backend/receiver/svg/SvgWriter';
import SvgReader from '../../../../../src/backend/receiver/svg/SvgReader';
import ShapeFactory from '../../../../../src/backend/receiver/document/shape/ShapeFactory';

function scene() {
  const workspace = new Workspace();
  const doc = new Document(800, 600);
  const panel = new CompositeShape('panel');
  doc.add(panel, null);
  workspace.replace(doc);
  return { workspace, doc, panel };
}

describe('直接继承 Shape 的复合模型', () => {
  it('统一保存组成、查找及父节点归属，不需要继承 Group', () => {
    const { doc, panel } = scene();
    expect(panel).toBeInstanceOf(Shape);
    expect(panel).not.toBeInstanceOf(Group);
    expect(panel.parent()).toBeNull();
    expect(panel.children().map((shape) => shape.id())).toEqual(['panel-rect', 'panel-label']);
    expect(doc.shapes().map((shape) => shape.id())).toEqual(['panel', 'panel-rect', 'panel-label']);
    expect(doc.requireShape('panel-label')).toBe(panel.children()[1]);
    expect(doc.requireShape('panel-label').parent()).toBe(panel);
  });

  it('通过领域方法修改已挂接的内部部件，外部不能破坏组成', () => {
    const { doc, panel } = scene();
    panel.setLabel('updated');
    panel.setFill('red');
    expect(doc.requireShape('panel-label').value('text')).toBe('updated');
    expect(doc.requireShape('panel-rect').value('fill')).toBe('red');
    expect(() => doc.remove(doc.requireShape('panel-label'))).toThrow('cannot remove internal part');
    expect(() => doc.relocate(doc.requireShape('panel-rect'), null)).toThrow('cannot remove internal part');
    expect(() => doc.add(new Group('extra'), panel)).toThrow('not a container: panel');
    expect(panel.children()).toHaveLength(2);
    expect(doc.find('extra')).toBeNull();
  });

  it('统一遍历包括不开放成员编辑的复合图形，tree 和 SVG 输出包含内部部件', () => {
    const { workspace, doc, panel } = scene();
    expect(panel.acceptsChildren()).toBe(false);
    expect(new TreeCommand(workspace, []).execute().lines()).toEqual([
      'svg (800x600)',
      '└── g#panel',
      '    ├── rect#panel-rect  x=10 y=20 width=100 height=50',
      '    └── text#panel-label  x=20 y=40 text="label"',
    ]);
    const svg = new SvgWriter().write(doc);
    expect(svg).toContain('<g id="panel">');
    expect(svg).toContain('<rect id="panel-rect" x="10" y="20" width="100" height="50"/>');
    expect(svg).toContain('<text id="panel-label" x="20" y="40">label</text>');
    // 当前测试模型保存为普通 g，读回按既有普通 SVG 行为恢复。
    expect(new SvgReader(new ShapeFactory()).read(svg).document.shapes().map((shape) => shape.id()))
      .toEqual(['panel', 'panel-rect', 'panel-label']);
  });

  it('默认整体变换及快照递归覆盖全部内部部件', () => {
    const { doc, panel } = scene();
    const before = doc.shapes().map((shape) => shape.entries());
    const saved = panel.capture();
    panel.move(5, 10);
    panel.scale(2);
    panel.setLabel('changed');
    panel.setFill('blue');
    expect(doc.requireShape('panel-rect').position()).toEqual(['30', '60']);
    expect(doc.requireShape('panel-label').position()).toEqual(['50', '100']);
    saved.restore();
    expect(doc.shapes().map((shape) => shape.entries())).toEqual(before);
  });

  it('后一个部件变换溢出时，恢复前面已变换的部件', () => {
    const { doc, panel } = scene();
    doc.requireShape('panel-label').set('y', `1${'0'.repeat(308)}`);
    const before = doc.shapes().map((shape) => shape.entries());
    expect(() => panel.scale(2)).toThrow('y must be a finite number');
    expect(doc.shapes().map((shape) => shape.entries())).toEqual(before);
  });

  it('完整子树 id 校验覆盖未实现 Group 的模型', () => {
    const doc = new Document(100, 100);
    doc.add(new Group('panel-label'), null);
    const candidate = new CompositeShape('panel');
    expect(() => doc.add(candidate, null)).toThrow('id already exists: panel-label');
    expect(candidate.parent()).toBeNull();
    expect(candidate.children()).toHaveLength(2);
    expect(doc.shapes().map((shape) => shape.id())).toEqual(['panel-label']);
  });

  it('组内可挂载整个复合图形，分组和撤销保留内部组成及对象身份', () => {
    const { workspace, doc, panel } = scene();
    const children = panel.children();
    const command = new GroupCommand(workspace, ['outer', 'panel']);
    command.execute();
    expect(panel.parent()).toBe(doc.requireShape('outer'));
    command.undo();
    expect(panel.parent()).toBeNull();
    expect(panel.children()).toEqual(children);
    expect(doc.requireShape('panel-label')).toBe(children[1]);
    expect(command.execute().lines()).toEqual(['g#outer created with 1 children']);
  });

  it('分组不能抽走复合图形内部部件，预检查失败不新增空组', () => {
    const { workspace, doc, panel } = scene();
    const sibling = new Group('sibling');
    doc.add(sibling, null);
    const command = new GroupCommand(workspace, ['new', 'sibling', 'panel-label']);
    expect(() => command.execute()).toThrow('cannot remove internal part');
    expect(doc.children()).toEqual([panel, sibling]);
    expect(doc.find('new')).toBeNull();
    expect(doc.requireShape('panel-label').parent()).toBe(panel);
  });

  it('拥有 children 不等于可解组，不给 Shape 增加解组方法', () => {
    const { workspace, doc, panel } = scene();
    const outer = new Group('outer');
    doc.add(outer, null);
    doc.relocate(panel, outer);
    expect(() => new UngroupCommand(workspace, ['panel']).execute()).toThrow('not a container: panel');
    expect(panel.parent()).toBe(outer);
    expect(panel.children()).toHaveLength(2);
  });

  it('叶子拒绝接收成员，并保持空列表及未挂接目标', () => {
    const leaf = new Rect('leaf', new Map([['x', 0], ['y', 0], ['width', 1], ['height', 1]]));
    const child = new Group('child');
    expect(() => leaf.insert(child)).toThrow('not a container: leaf');
    expect(leaf.children()).toEqual([]);
    expect(child.parent()).toBeNull();
  });

  it('其他 Shape 也可自行开放成员接入，create 和 addto 不依赖 Group 类型', () => {
    class OpenShape extends Shape {
      static override readonly type = 'open';

      constructor(id: string) { super(id, new Map(), []); }

      override acceptsChildren(): boolean { return true; }
      override checkRemove(_shape: Shape): void {}
    }
    const { workspace, doc, panel } = scene();
    workspace.shapes().register(OpenShape);
    new CreateCommand(workspace, ['open', 'target']).execute();
    new CreateCommand(workspace, ['rect', 'member', '0', '0', '1', '1', 'in', 'target']).execute();
    const command = new AddtoCommand(workspace, ['target', 'panel']);
    command.execute();
    const target = doc.requireShape('target');
    expect(target).not.toBeInstanceOf(Group);
    expect(target.children().map((shape) => shape.id())).toEqual(['member', 'panel']);
    expect(panel.parent()).toBe(target);
    command.undo();
    expect(panel.parent()).toBeNull();
  });
});
