import DecimalFormat from '../../utils/DecimalFormat';
import type Document from '../document/Document';
import type ShapeNode from '../document/ShapeNode';
import Shape from '../document/shape/Shape';
import type { SvgElement } from '../document/shape/SvgElement';
import EditorError from '../../error/EditorError';

/**
 * 把文档写成 SVG 文本：XML 声明 + `<svg xmlns width height viewBox>` + 2 空格缩进的嵌套元素。
 * 每个模型多态提供自身及私有部件的 `toSvg()`，Writer 追加文档成员，校验完整元素树后格式化文本。
 */
export default class SvgWriter {
  private static readonly decimal = new DecimalFormat();

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
    const own = node.value.toSvg();
    this.checkOwn(node.value, own);
    return {
      ...own,
      children: [...(own.children ?? []), ...node.children().map((child) => this.mapNode(child))],
    };
  }

  /** 校验模型自身元素：标签、类型标记及声明 id 都已写出；额外结构 id 交给全局检查。 */
  private checkOwn(shape: Shape, element: SvgElement): void {
    if (element.type !== shape.element()) {
      throw new EditorError(`SVG element mismatch: ${shape.id()} (<${element.type}> != <${shape.element()}>)`);
    }
    const kinds = element.attributes.filter(([name]) => name === 'data-kind');
    if (kinds.length > 1) throw new EditorError(`multiple data-kind attributes: ${shape.id()}`);
    if (kinds.length === 1 && String(kinds[0][1]) !== shape.type()) {
      throw new EditorError(`data-kind mismatch: ${shape.id()}`);
    }
    if (shape.element() !== shape.type() && kinds.length === 0) {
      throw new EditorError(`missing data-kind: ${shape.id()}`);
    }
    const written = new Set<string>();
    SvgWriter.collectIds(element, written);
    for (const id of shape.identifiers()) {
      if (!written.has(id)) throw new EditorError(`missing SVG element id: ${id}`);
    }
  }

  private static collectIds(element: SvgElement, ids: Set<string>): void {
    for (const [name, value] of element.attributes) {
      if (name === 'id') ids.add(String(value));
    }
    for (const child of element.children ?? []) SvgWriter.collectIds(child, ids);
  }

  /** 在生成文本前校验完整元素树，包含私有部件与普通文档成员。 */
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
