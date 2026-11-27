/**
 * 大纲使用的语法节点：只保存元素名称、id 和源码范围，不包含 SVG 领域模型。
 * offset 与 JavaScript 字符串下标一致，交给 TextDocument.positionAt 转换。
 */
export default class SvgElementNode {
  constructor(
    private readonly tagName: string,
    private readonly elementId: string | null,
    private readonly startOffset: number,
    private readonly nameStartOffset: number,
    private readonly nameEndOffset: number,
    private readonly endOffset: number,
    private readonly childNodes: readonly SvgElementNode[],
  ) {}

  tag(): string {
    return this.tagName;
  }

  id(): string | null {
    return this.elementId;
  }

  start(): number {
    return this.startOffset;
  }

  nameStart(): number {
    return this.nameStartOffset;
  }

  nameEnd(): number {
    return this.nameEndOffset;
  }

  end(): number {
    return this.endOffset;
  }

  children(): readonly SvgElementNode[] {
    return this.childNodes;
  }

  /** Outline 显示名：有 id 时为 `标签#id`，否则只有标签名。 */
  name(): string {
    return this.elementId === null ? this.tagName : `${this.tagName}#${this.elementId}`;
  }
}
