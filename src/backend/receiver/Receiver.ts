import EditorError from '../error/EditorError';
import type Document from './document/Document';
import type ShapeNode from './document/ShapeNode';
import type AttributeHandler from './document/shape/AttributeHandler';
import type AttributeHandlerRegistry from './document/shape/AttributeHandlerRegistry';
import type Shape from './document/shape/Shape';
import type ShapeFactory from './document/shape/ShapeFactory';
import type SvgFile from './svg/SvgFile';
import type SvgReader from './svg/SvgReader';
import type SvgWriter from './svg/SvgWriter';
import type TreeRenderer from './tree/TreeRenderer';
import type { TreeSuccess } from './tree/TreeLineRenderer';

/**
 * 编辑命令的接收者，持有当前文档和文件路径，通过装配好的服务提供编辑器操作。
 */
export default class Receiver {
  private current: Document | null = null;
  /** 当前文档对应的文件；init 新建的文档在首次 `save <file>` 之前没有路径。 */
  private currentPath: string | null = null;
  constructor(
    private readonly factory: ShapeFactory,
    private readonly file: Pick<SvgFile, 'read' | 'write'>,
    private readonly reader: Pick<SvgReader, 'read'>,
    private readonly writer: Pick<SvgWriter, 'write'>,
    private readonly handlerRegistry: AttributeHandlerRegistry,
    private readonly tree: TreeRenderer,
  ) {}

  shapeDefinition(type: string): ReturnType<ShapeFactory['definition']> {
    return this.factory.definition(type);
  }

  /** 按 id 构造候选，逐项写入后做一次整图校验；创建阶段不调用公开 set。 */
  createShape(type: string, id: string, inputs: readonly (readonly [string, string])[] = []): Shape {
    const shape = this.factory.create(type, id);
    for (const [name, token] of inputs) {
      this.write(shape, name, token);
    }
    shape.validate();
    return shape;
  }

  /** 唯一写入动作：一次匹配后交给 Handler 或模型默认规则，不校验、不回显。 */
  private write(
    shape: Shape,
    key: string,
    token: string,
    handler: AttributeHandler | null = this.handlerRegistry.resolve(shape, key),
  ): void {
    if (handler === null) shape.set(key, token);
    else handler.apply(shape, key, token);
  }

  /** 编辑入口：同一次匹配内读取旧值、写入、整图校验，再读取新值。 */
  set(shape: Shape, key: string, token: string): { previous: string | null; current: string | null } {
    const handler = this.handlerRegistry.resolve(shape, key);
    const read = (): string | null => (handler === null ? shape.display(key) : handler.display(shape, key));
    const previous = read();
    this.write(shape, key, token, handler);
    shape.validate();
    return { previous, current: read() };
  }

  renderTree(root: ShapeNode | null): readonly string[] {
    return this.tree.render(this.document(), root);
  }

  notifyTree(kind: TreeSuccess['kind']): readonly string[] {
    return this.current === null ? [] : this.tree.notify(kind, this.current);
  }

  /** 读入和解析全部成功之后才替换文档。 */
  readDocument(path: string) {
    const { document, warnings } = this.reader.read(this.file.read(path));
    const replaced = this.replace(document, path);
    return { document, warnings, replaced };
  }

  /** 文件写出成功之后才更新当前路径。 */
  saveDocument(target: string | null) {
    const document = this.document();
    const path = target ?? this.path();
    this.file.write(path, this.writer.write(document));
    this.currentPath = path;
    return { document, path };
  }

  /** 当前文档；没有文档时报错。 */
  document(): Document {
    if (this.current === null) {
      throw new EditorError("no document. use 'init' or 'read' first");
    }
    return this.current;
  }

  /** 以 doc 替换当前文档，并以 path 作为其文件路径（init 新建时为 null）；返回是否覆盖了已有文档。 */
  replace(doc: Document, path: string | null = null): boolean {
    const replaced = this.current !== null;
    this.current = doc;
    this.currentPath = path;
    return replaced;
  }

  /** 当前文档的文件路径；没有时报错。 */
  path(): string {
    if (this.currentPath === null) {
      throw new EditorError("no file path. use 'save <file.svg>'");
    }
    return this.currentPath;
  }
}
