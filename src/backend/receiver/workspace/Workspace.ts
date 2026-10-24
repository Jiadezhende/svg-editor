import EditorError from '../../error/EditorError';
import type Document from '../document/Document';
import ShapeFactory from '../document/shape/ShapeFactory';
import SvgFile from '../svg/SvgFile';

/**
 * 编辑会话的接收者上下文：当前文档槽位（同一时刻至多持有一个文档）及其文件路径、图形工厂、文件读写。
 * "无文档"只在这里判定，命令与 Client 不感知有无文档。
 */
export default class Workspace {
  private current: Document | null = null;
  /** 当前文档对应的文件；init 新建的文档在首次 `save <file>` 之前没有路径。 */
  private currentPath: string | null = null;
  private readonly factory = new ShapeFactory();
  private readonly file = new SvgFile();

  /** 图形工厂，与有无文档无关。 */
  shapes(): ShapeFactory {
    return this.factory;
  }

  /** 文件读写，与有无文档无关。 */
  files(): SvgFile {
    return this.file;
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
