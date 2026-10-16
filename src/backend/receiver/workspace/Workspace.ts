import EditorError from '../../error/EditorError';
import type Document from '../document/Document';

/**
 * 当前文档槽位：同一时刻至多持有一个文档。
 * "无文档"只在这里判定，命令与 Client 不感知有无文档；文件路径随 SVG 读写加入。
 */
export default class Workspace {
  private current: Document | null = null;

  /** 当前文档；没有文档时报错。 */
  document(): Document {
    if (this.current === null) {
      throw new EditorError("no document. use 'init' or 'read' first");
    }
    return this.current;
  }

  /** 以 doc 替换当前文档，返回是否覆盖了已有文档。 */
  replace(doc: Document): boolean {
    const replaced = this.current !== null;
    this.current = doc;
    return replaced;
  }
}
