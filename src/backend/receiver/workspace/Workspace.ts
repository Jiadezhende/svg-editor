import EditorError from '../../error/EditorError';
import type AttributeHandlers from '../../handler/AttributeHandlers';
import type Document from '../document/Document';
import type ShapeFactory from '../document/shape/ShapeFactory';
import type SvgFile from '../svg/SvgFile';
import type SvgReader from '../svg/SvgReader';
import type SvgWriter from '../svg/SvgWriter';

/**
 * 编辑会话的接收者上下文：当前文档槽位（同一时刻至多持有一个文档）及其文件路径、图形工厂、文件读写。
 * "无文档"只在这里判定，命令与 Client 不感知有无文档。
 */
export default class Workspace {
  private current: Document | null = null;
  /** 当前文档对应的文件；init 新建的文档在首次 `save <file>` 之前没有路径。 */
  private currentPath: string | null = null;
  constructor(
    private readonly factory: ShapeFactory,
    private readonly file: Pick<SvgFile, 'read' | 'write'>,
    private readonly reader: Pick<SvgReader, 'read'>,
    private readonly writer: Pick<SvgWriter, 'register' | 'write'>,
    private readonly handlers: AttributeHandlers,
  ) {}

  /** 图形工厂，与有无文档无关。 */
  shapes(): ShapeFactory {
    return this.factory;
  }

  /** 宿主按启用顺序注册的静态属性处理器。 */
  attributeHandlers(): AttributeHandlers {
    return this.handlers;
  }

  /** 文件读写，与有无文档无关。 */
  files(): Pick<SvgFile, 'read' | 'write'> {
    return this.file;
  }

  /** read 使用装配时提供的解析器，与创建流程共享宿主选定的类型注册。 */
  svgReader(): Pick<SvgReader, 'read'> {
    return this.reader;
  }

  /** 写出映射在会话装配时注册，save 复用同一写出器。 */
  svgWriter(): Pick<SvgWriter, 'register' | 'write'> {
    return this.writer;
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

  /** 另存为后，path 成为当前文档的文件路径。 */
  setPath(path: string): void {
    this.currentPath = path;
  }
}
