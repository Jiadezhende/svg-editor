import { createWorkspace, createShapeFactory } from '../../../../support/Plugins';
import { describe, expect, it } from 'vitest';
import CompositeShape from '../../../../support/CompositeShape';
import Shape from '../../../../../src/backend/receiver/document/shape/Shape';
import Group from '../../../../../plugins/shapes/Group';
import Document from '../../../../../src/backend/receiver/document/Document';
import GroupCommand from '../../../../../plugins/commands/GroupCommand';
import MoveCommand from '../../../../../plugins/commands/MoveCommand';
import ScaleCommand from '../../../../../plugins/commands/ScaleCommand';
import TreeCommand from '../../../../../plugins/commands/TreeCommand';
import SvgWriter from '../../../../../src/backend/receiver/svg/SvgWriter';
import SvgReader from '../../../../../src/backend/receiver/svg/SvgReader';

async function scene() {
  const workspace = (await createWorkspace());
  const doc = new Document(800, 600);
  const panel = new CompositeShape('panel');
  const node = doc.insert(panel);
  workspace.replace(doc);
  return { workspace, doc, panel, node };
}

describe('业务复合模型与文档节点分离', () => {
  it('内部成员由具体模型持有，不自动成为文档节点', async () => {
    const { doc, panel, node, workspace } = (await scene());
    expect(panel).toBeInstanceOf(Shape);
    expect(panel).not.toBeInstanceOf(Group);
    expect(node.children()).toEqual([]);
    expect(doc.nodes().map((node) => node.value)).toEqual([panel]);
    expect(doc.findNode('panel-label')).toBeNull();
    expect('children' in panel).toBe(false);
    expect(() => doc.insert(new Group('extra'), node)).toThrow('not a container: panel');
    expect(new TreeCommand(workspace, []).execute().lines()).toEqual(['svg (800x600)', '└── g#panel']);
  });

  it('领域方法修改部件，属性快照恢复整个业务模型', async () => {
    const { panel } = (await scene());
    const saved = panel.capture();
    panel.setLabel('changed');
    panel.setFill('red');
    panel.move(5, 10);
    panel.scale(2);
    expect(panel.frameShape().position()).toEqual(['30', '60']);
    expect(panel.captionShape().position()).toEqual(['50', '100']);
    expect(panel.captionShape().value('text')).toBe('changed');
    saved.restore();
    expect(panel.frameShape().position()).toEqual(['10', '20']);
    expect(panel.captionShape().value('text')).toBe('label');
    expect(panel.frameShape().value('fill')).toBeNull();
  });

  it('普通节点分组与复合模型变换不重复处理内部成员，命令撤销也恢复部件', async () => {
    const { workspace, doc, panel, node } = (await scene());
    const group = new GroupCommand(workspace, ['outer', 'panel']);
    group.execute();
    const move = new MoveCommand(workspace, ['outer', '5', '10']);
    move.execute();
    expect(panel.frameShape().position()).toEqual(['15', '30']);
    move.undo();
    const scale = new ScaleCommand(workspace, ['outer', '2']);
    scale.execute();
    expect(panel.frameShape().position()).toEqual(['20', '40']);
    scale.undo();
    group.undo();
    expect(doc.requireNode('panel')).toBe(node);
    expect(node.parent()).toBeNull();
    expect(panel.frameShape().position()).toEqual(['10', '20']);
  });

  it('后一个内部部件溢出时恢复先前部件，文档变换也恢复前面的普通节点', async () => {
    const { doc, panel, node } = (await scene());
    const root = doc.insert(new Group('outer'));
    const other = doc.insert(new Group('other', new Map([['stroke-width', 1]])), root);
    doc.relocate(node, root);
    panel.captionShape().set('y', `1${'0'.repeat(308)}`);
    const before = panel.frameShape().entries();
    expect(() => doc.scale(root, 2)).toThrow('y must be a finite number');
    expect(panel.frameShape().entries()).toEqual(before);
    expect(other.value.value('stroke-width')).toBe(1);
  });

  it('复合 SVG 映射独立于文档树，读回普通 SVG 时保留全部嵌套元素', async () => {
    const { doc, panel } = (await scene());
    const writer = new SvgWriter([{
      matches: (shape) => shape instanceof CompositeShape,
      write: (shape) => {
        const model = shape as CompositeShape;
        return { ...SvgWriter.elementOf(model), children: [
          SvgWriter.elementOf(model.frameShape()),
          { type: 'g', attributes: [['id', 'title-group']], children: [SvgWriter.elementOf(model.captionShape())] },
        ] };
      },
    }]);
    const svg = writer.write(doc);
    expect(svg).toContain('<rect id="panel-rect" x="10" y="20" width="100" height="50"/>');
    expect(svg).toContain('<text id="panel-label" x="20" y="40">label</text>');
    expect(doc.nodes().map((node) => node.value)).toEqual([panel]);
    const read = new SvgReader((await createShapeFactory())).read(svg).document;
    expect(read.nodes().map((node) => node.value).map((shape) => shape.id())).toEqual(['panel', 'panel-rect', 'title-group', 'panel-label']);
    expect(read.requireNode('panel-label').parent()).toBe(read.requireNode('title-group'));
    expect(new SvgWriter().write(read)).toBe(svg);
  });
});
