import DecimalFormat from '../../utils/DecimalFormat';
import type Document from '../document/Document';
import type ShapeNode from '../document/ShapeNode';
import Shape from '../document/shape/Shape';
import EditorError from '../../error/EditorError';

/** SVG 映射结果，不携带文档节点关系。 */
export interface SvgElement {
  readonly type: string;
  readonly attributes: ReadonlyArray<readonly [string, number | string]>;
  readonly content?: number | string | null;
  readonly children?: readonly SvgElement[];
}

/** 业务复合模型的显式写出映射；普通 SVG 仍按文档节点遍历。 */
export interface SvgShapeMapping {
  matches(shape: Shape): boolean;
  write(shape: Shape): SvgElement;
}

/**
 * 把文档写成 SVG 文本：XML 声明 + `<svg xmlns width height viewBox>` + 2 空格缩进的嵌套元素。
 * 按图形类的声明通用处理：元素名取 `element()`（默认与类型名相同），属性依次为 id 与属性表中已设置的属性，`content` 属性写成子文本，
 * 容器递归子节点；没有子节点也没有子文本的元素自闭合。
 */
export default class SvgWriter {
  private static readonly decimal = new DecimalFormat();

  private readonly mappings: SvgShapeMapping[];

  constructor(mappings: readonly SvgShapeMapping[] = []) {
    this.mappings = [...mappings];
  }

  register(mapping: SvgShapeMapping): void {
    this.mappings.push(mapping);
  }

  static elementOf(shape: Shape): SvgElement {
    return { type: shape.element(), attributes: [['id', shape.id()], ...shape.entries()], content: shape.content() };
  }

  write(doc: Document): string {
    const elements = doc.children().map((node) => this.mapNode(node));
    const ids = new Set<string>();
    for (const element of elements) this.checkElement(element, ids);
    const size = [doc.width(), doc.height()].map((n) => SvgWriter.decimal.format(n));
    const viewBox = doc.viewBox().map((n) => SvgWriter.decimal.format(n)).join(' ');
    const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="${viewBox}"`;
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    if (elements.length === 0) {
      lines.push(`${root}/>`);
    } else {
      lines.push(`${root}>`);
      for (const element of elements) this.writeElement(element, 1, lines);
      lines.push('</svg>');
    }
    return `${lines.join('\n')}\n`;
  }

  private mapNode(node: ShapeNode): SvgElement {
    const matches = this.mappings.filter((mapping) => mapping.matches(node.value));
    if (matches.length > 1) throw new EditorError(`multiple SVG mappings: ${node.value.id()}`);
    if (matches.length === 1) {
      const mapped = matches[0].write(node.value);
      return { ...mapped, children: [...(mapped.children ?? []), ...node.children().map((child) => this.mapNode(child))] };
    }
    return { ...SvgWriter.elementOf(node.value), children: node.children().map((child) => this.mapNode(child)) };
  }

  /** 在生成文本前校验完整映射树，包含私有部件与普通文档成员。 */
  private checkElement(element: SvgElement, ids: Set<string>): void {
    const declared = element.attributes.filter(([name]) => name === 'id');
    if (declared.length > 1) throw new EditorError('multiple id attributes in SVG element');
    if (declared.length === 1) {
      const id = String(declared[0][1]);
      Shape.checkId(id);
      if (ids.has(id)) throw new EditorError(`id already exists: ${id}`);
      ids.add(id);
    }
    if (element.content != null && (element.children?.length ?? 0) > 0) {
      throw new EditorError(`SVG element has both content and children: ${element.type}`);
    }
    for (const child of element.children ?? []) this.checkElement(child, ids);
  }

  private writeElement(element: SvgElement, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth);
    const type = element.type;
    const attributes = element.attributes
      .map(([name, value]) => ` ${name}="${SvgWriter.escapeAttribute(SvgWriter.text(value))}"`)
      .join('');
    const open = `${indent}<${type}${attributes}`;
    const content = element.content ?? null;
    const children = element.children ?? [];
    if (content !== null) {
      lines.push(`${open}>${SvgWriter.escapeText(SvgWriter.text(content))}</${type}>`);
    } else if (children.length === 0) {
      lines.push(`${open}/>`);
    } else {
      lines.push(`${open}>`);
      for (const child of children) {
        this.writeElement(child, depth + 1, lines);
      }
      lines.push(`${indent}</${type}>`);
    }
  }

  /** 属性原值的文本形式：数值按数值格式，字符串原样。 */
  private static text(value: number | string): string {
    return typeof value === 'number' ? SvgWriter.decimal.format(value) : value;
  }

  private static escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private static escapeAttribute(text: string): string {
    return SvgWriter.escapeText(text).replace(/"/g, '&quot;');
  }
}
