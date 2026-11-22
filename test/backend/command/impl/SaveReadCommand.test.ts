import { createHost, createReceiver } from '../../../support/Plugins';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CreateCommand from '../../../../plugins/core/CreateCommand';
import DocumentCommand from '../../../../src/backend/command/DocumentCommand';
import ReadCommand from '../../../../plugins/core/ReadCommand';
import SaveCommand from '../../../../plugins/core/SaveCommand';
import TreeCommand from '../../../../plugins/core/TreeCommand';
import EditorError from '../../../../src/backend/error/EditorError';
import Document from '../../../../src/backend/receiver/document/Document';
import Receiver from '../../../../src/backend/receiver/Receiver';
import SvgWriter from '../../../../src/backend/receiver/svg/SvgWriter';
import CompositeShape from '../../../support/CompositeShape';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'svg-cmd-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 文档含 bg、title、markers{c1, box}。 */
async function sample(): Promise<Receiver> {
  const receiver = (await createReceiver());
  receiver.replace(new Document(800, 600));
  for (const args of [
    ['rect', 'bg', '0', '0', '800', '600', '#ffffff'],
    ['text', 'title', '20', '40', 'My Diagram'],
    ['g', 'markers'],
    ['circle', 'c1', '100', '100', '20', 'red', 'in', 'markers'],
    ['rect', 'box', '200', '80', '60', '60', '#3366ff', 'in', 'markers'],
  ]) {
    new CreateCommand(receiver, args).execute();
  }
  return receiver;
}

function tree(receiver: Receiver): string[] {
  return [...new TreeCommand(receiver, []).execute().lines()];
}

describe('SaveCommand', () => {
  it('是文档类命令；保存并回显元素数（含 g，不含 svg 根）', async () => {
    const path = join(dir, 'demo.svg');
    const command = new SaveCommand((await sample()), [path]);
    expect(command).toBeInstanceOf(DocumentCommand);
    expect(command.execute().lines()).toEqual([`saved to ${path} (5 elements)`]);
    expect(readFileSync(path, 'utf8')).toContain('<circle id="c1" cx="100" cy="100" r="20" fill="red"/>');
  });

  it('save <path> 后该路径成为当前路径，无参 save 保存到这里', async () => {
    const receiver = (await sample());
    const path = join(dir, 'a.svg');
    new SaveCommand(receiver, [path]).execute();
    new CreateCommand(receiver, ['g', 'later']).execute();
    expect(new SaveCommand(receiver, []).execute().lines()).toEqual([`saved to ${path} (6 elements)`]);
    expect(readFileSync(path, 'utf8')).toContain('<g id="later"/>');
  });

  it('文档来自 init（无路径）时无参 save 报错，提示指定文件名', async () => {
    await expect(async () => new SaveCommand((await sample()), []).execute()).rejects.toThrow(new EditorError("no file path. use 'save <file.svg>'"));
  });

  it('文件不可写时报错，当前路径不变', async () => {
    const receiver = (await sample());
    const good = join(dir, 'a.svg');
    new SaveCommand(receiver, [good]).execute();
    const bad = join(dir, 'missing', 'b.svg');
    expect(() => new SaveCommand(receiver, [bad]).execute()).toThrow(new EditorError(`cannot write file: ${bad}`));
    expect(receiver.path()).toBe(good);
  });

  it('无文档时报无文档；参数个数在构造时校验', async () => {
    await expect(async () => new SaveCommand((await createReceiver()), ['a.svg']).execute()).rejects.toThrow("no document. use 'init' or 'read' first");
    await expect(async () => new SaveCommand((await createReceiver()), ['a', 'b'])).rejects.toThrow('wrong number of arguments. usage: save [file.svg]');
  });
});

describe('SaveCommand 的复合模型映射', () => {
  it('保存复用会话注册的写出映射，内部成员不进入文档节点树', async () => {
    const { receiver, writer } = await createHost();
    const doc = new Document(100, 100);
    const panel = new CompositeShape('panel');
    doc.insert(panel);
    receiver.replace(doc);
    writer.register({
      matches: (shape) => shape instanceof CompositeShape,
      write: (shape) => {
        const model = shape as CompositeShape;
        return { ...SvgWriter.elementOf(model), children: [
          SvgWriter.elementOf(model.frameShape()), SvgWriter.elementOf(model.captionShape()),
        ] };
      },
    });
    const path = join(dir, 'composite.svg');
    expect(new SaveCommand(receiver, [path]).execute().lines()).toEqual([`saved to ${path} (1 elements)`]);
    const svg = readFileSync(path, 'utf8');
    expect(svg).toContain('<rect id="panel-rect"');
    expect(svg).toContain('<text id="panel-label"');
    expect(doc.nodes().map((node) => node.value)).toEqual([panel]);
    new ReadCommand(receiver, [path]).execute();
    expect(receiver.document().nodes().map((node) => node.value).map((shape) => shape.id())).toEqual(['panel', 'panel-rect', 'panel-label']);
  });
});

describe('ReadCommand', () => {
  it('是文档类命令；save 后 read 读回，tree 与保存前一致，回显元素数', async () => {
    const original = (await sample());
    const path = join(dir, 'demo.svg');
    new SaveCommand(original, [path]).execute();
    const receiver = (await createReceiver());
    const command = new ReadCommand(receiver, [path]);
    expect(command).toBeInstanceOf(DocumentCommand);
    const result = command.execute();
    expect(result.warnings()).toEqual([]);
    expect(result.lines()).toEqual([`read ${path} (5 elements)`]);
    expect(tree(receiver)).toEqual(tree(original));
  });

  it('read 后无参 save 保存到读入时的路径', async () => {
    const path = join(dir, 'demo.svg');
    new SaveCommand((await sample()), [path]).execute();
    const receiver = (await createReceiver());
    new ReadCommand(receiver, [path]).execute();
    expect(new SaveCommand(receiver, []).execute().lines()).toEqual([`saved to ${path} (5 elements)`]);
  });

  it('补 id 等读入警告先于结果行；覆盖已有文档时追加丢弃警告', async () => {
    const path = join(dir, 'other.svg');
    writeFileSync(path, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect x="0" y="0" width="1" height="1"/></svg>');
    const receiver = (await sample());
    const result = new ReadCommand(receiver, [path]).execute();
    expect(result.warnings()).toEqual(['assigned id rect1 to unnamed <rect>', 'previous document discarded']);
    expect(result.lines()).toEqual([`read ${path} (1 elements)`]);
    expect([receiver.document().width(), receiver.document().height()]).toEqual([400, 300]);
  });

  it('文件不存在时报 cannot read file，当前文档不变', async () => {
    const receiver = (await sample());
    const before = receiver.document();
    const path = join(dir, 'a.svg');
    expect(() => new ReadCommand(receiver, [path]).execute()).toThrow(new EditorError(`cannot read file: ${path}`));
    expect(receiver.document()).toBe(before);
  });

  it('文件内容非法时报错，当前文档与路径不变', async () => {
    const receiver = (await sample());
    const good = join(dir, 'good.svg');
    new SaveCommand(receiver, [good]).execute();
    const before = receiver.document();
    const bad = join(dir, 'bad.svg');
    writeFileSync(bad, '<svg><rect id="a" x="1" y="1" width="1" height="1"/><rect id="a" x="1" y="1" width="1" height="1"/></svg>');
    expect(() => new ReadCommand(receiver, [bad]).execute()).toThrow('id already exists: a');
    expect(receiver.document()).toBe(before);
    expect(receiver.path()).toBe(good);
  });

  it('参数个数在构造时校验', async () => {
    await expect(async () => new ReadCommand((await createReceiver()), [])).rejects.toThrow('wrong number of arguments. usage: read <file.svg>');
  });
});
