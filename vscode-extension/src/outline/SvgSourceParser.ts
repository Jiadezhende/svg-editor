import SvgElementNode from './SvgElementNode';

interface OpenElement {
  readonly tag: string;
  readonly id: string | null;
  readonly start: number;
  readonly nameStart: number;
  readonly nameEnd: number;
  readonly children: SvgElementNode[];
}

interface StartTag {
  readonly tag: string;
  readonly id: string | null;
  readonly nameStart: number;
  readonly nameEnd: number;
  readonly end: number;
  readonly selfClosing: boolean;
}

interface EndTag {
  readonly tag: string;
  readonly end: number;
}

/**
 * 读取 SVG 源码中的元素结构，只服务于大纲。
 * 它不构建 CLI 的 Shape/Document，也不做完整 SVG 规范校验；
 * XML 不完整或结构错误时返回空数组，让 Outline 暂时清空并在下次合法输入时恢复。
 */
export default class SvgSourceParser {
  parse(text: string): readonly SvgElementNode[] {
    const roots: SvgElementNode[] = [];
    const stack: OpenElement[] = [];
    let index = 0;

    while (index < text.length) {
      if (text[index] !== '<') {
        index += 1;
        continue;
      }

      if (text.startsWith('<!--', index)) {
        const end = text.indexOf('-->', index + 4);
        if (end < 0) return [];
        index = end + 3;
        continue;
      }

      if (text.startsWith('<![CDATA[', index)) {
        const end = text.indexOf(']]>', index + 9);
        if (end < 0) return [];
        index = end + 3;
        continue;
      }

      if (text.startsWith('<?', index)) {
        const end = text.indexOf('?>', index + 2);
        if (end < 0) return [];
        index = end + 2;
        continue;
      }

      if (text.startsWith('<!DOCTYPE', index) || text.startsWith('<!doctype', index)) {
        const end = this.declarationEnd(text, index);
        if (end === null) return [];
        index = end;
        continue;
      }

      if (text.startsWith('</', index)) {
        const endTag = this.endTag(text, index);
        if (endTag === null || stack.length === 0) return [];
        const open = stack.pop()!;
        if (open.tag !== endTag.tag) return [];
        const node = new SvgElementNode(open.tag, open.id, open.start, open.nameStart, open.nameEnd,
          endTag.end, open.children);
        this.append(roots, stack, node);
        index = endTag.end;
        continue;
      }

      const startTag = this.startTag(text, index);
      if (startTag === null) return [];
      const node = startTag.selfClosing
        ? new SvgElementNode(startTag.tag, startTag.id, index, startTag.nameStart, startTag.nameEnd,
          startTag.end, [])
        : null;
      if (node === null) {
        stack.push({
          tag: startTag.tag,
          id: startTag.id,
          start: index,
          nameStart: startTag.nameStart,
          nameEnd: startTag.nameEnd,
          children: [],
        });
      } else {
        this.append(roots, stack, node);
      }
      index = startTag.end;
    }

    // 仍有未闭合元素：输入不完整，按约定清空大纲。
    return stack.length === 0 ? roots : [];
  }

  private append(roots: SvgElementNode[], stack: readonly OpenElement[], node: SvgElementNode): void {
    const parent = stack[stack.length - 1];
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
  }

  /** 从 `<` 开始读取开始标签；格式不合法时返回 null。 */
  private startTag(text: string, start: number): StartTag | null {
    let index = start + 1;
    const nameStart = index;
    while (index < text.length && this.isNameChar(text[index])) index += 1;
    const nameEnd = index;
    if (nameEnd === nameStart) return null;
    const tag = text.slice(nameStart, nameEnd);
    if (!this.isNameStart(tag[0])) return null;

    let id: string | null = null;
    while (index < text.length) {
      index = this.skipWhitespace(text, index);
      if (index >= text.length) return null;
      if (text[index] === '>') {
        return { tag, id, nameStart, nameEnd, end: index + 1, selfClosing: false };
      }
      if (text[index] === '/' && text[index + 1] === '>') {
        return { tag, id, nameStart, nameEnd, end: index + 2, selfClosing: true };
      }

      const attributeStart = index;
      while (index < text.length && this.isAttributeNameChar(text[index])) index += 1;
      if (index === attributeStart) return null;
      const attribute = text.slice(attributeStart, index);
      index = this.skipWhitespace(text, index);
      if (text[index] !== '=') return null;
      index += 1;
      index = this.skipWhitespace(text, index);
      const quote = text[index];
      if (quote !== '"' && quote !== "'") return null;
      const valueStart = index + 1;
      const valueEnd = text.indexOf(quote, valueStart);
      if (valueEnd < 0) return null;
      if (attribute === 'id') {
        const value = this.decodeEntities(text.slice(valueStart, valueEnd));
        id = value === '' ? null : value;
      }
      index = valueEnd + 1;
    }
    return null;
  }

  /** 从 `</` 开始读取结束标签；格式不合法时返回 null。 */
  private endTag(text: string, start: number): EndTag | null {
    let index = start + 2;
    const nameStart = index;
    while (index < text.length && this.isNameChar(text[index])) index += 1;
    const tag = text.slice(nameStart, index);
    if (tag === '' || !this.isNameStart(tag[0])) return null;
    index = this.skipWhitespace(text, index);
    if (text[index] !== '>') return null;
    return { tag, end: index + 1 };
  }

  /** 跳过 DOCTYPE 声明，允许内部子集和引号中的 `>`。 */
  private declarationEnd(text: string, start: number): number | null {
    let index = start + 2;
    let bracketDepth = 0;
    let quote: string | null = null;
    while (index < text.length) {
      const char = text[index];
      if (quote !== null) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '[') {
        bracketDepth += 1;
      } else if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (char === '>' && bracketDepth === 0) {
        return index + 1;
      }
      index += 1;
    }
    return null;
  }

  private skipWhitespace(text: string, start: number): number {
    let index = start;
    while (index < text.length && /\s/.test(text[index])) index += 1;
    return index;
  }

  private isNameStart(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z_:]/.test(char);
  }

  private isNameChar(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z0-9_:.-]/.test(char);
  }

  private isAttributeNameChar(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z0-9_:.-]/.test(char);
  }

  /** 解析 Outline 展示需要的基础 XML 实体。 */
  private decodeEntities(value: string): string {
    return value.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (whole, entity: string) => {
      switch (entity) {
        case 'amp': return '&';
        case 'lt': return '<';
        case 'gt': return '>';
        case 'quot': return '"';
        case 'apos': return "'";
        default: {
          const codePoint = entity.startsWith('#x')
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
          return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : whole;
        }
      }
    });
  }
}
