import type { AttributeValue } from '../document/attribute/AttributeSpec';
import DecimalFormat from '../document/attribute/DecimalFormat';
import type Document from '../document/Document';
import type Shape from '../document/shape/Shape';

/**
 * 把文档写成 SVG 文本：XML 声明 + `<svg xmlns width height viewBox>` + 2 空格缩进的嵌套元素。
 * 按图形类的声明通用处理：元素名即类型名，属性依次为 id 与属性表中已设置的属性，`content` 属性写成子文本，
 * 容器递归子节点；没有子节点也没有子文本的元素自闭合。
 */
export default class SvgWriter {
  private static readonly decimal = new DecimalFormat();

  write(doc: Document): string {
    const size = [doc.width(), doc.height()].map((n) => SvgWriter.decimal.format(n));
    const viewBox = doc.viewBox().map((n) => SvgWriter.decimal.format(n)).join(' ');
    const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="${viewBox}"`;
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    if (doc.children().length === 0) {
      lines.push(`${root}/>`);
    } else {
      lines.push(`${root}>`);
      for (const shape of doc.children()) {
        this.element(shape, 1, lines);
      }
      lines.push('</svg>');
    }
    return `${lines.join('\n')}\n`;
  }

  private element(shape: Shape, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth);
    const type = shape.type();
    const attributes = [['id', shape.id()] as const, ...shape.entries()]
      .map(([name, value]) => ` ${name}="${SvgWriter.escapeAttribute(SvgWriter.text(value))}"`)
      .join('');
    const open = `${indent}<${type}${attributes}`;
    const content = shape.content();
    const children = shape.asContainer()?.children() ?? [];
    if (content !== null) {
      lines.push(`${open}>${SvgWriter.escapeText(SvgWriter.text(content))}</${type}>`);
    } else if (children.length === 0) {
      lines.push(`${open}/>`);
    } else {
      lines.push(`${open}>`);
      for (const child of children) {
        this.element(child, depth + 1, lines);
      }
      lines.push(`${indent}</${type}>`);
    }
  }

  /** 属性原值的文本形式：数值按数值格式，字符串原样。 */
  private static text(value: AttributeValue): string {
    return typeof value === 'number' ? SvgWriter.decimal.format(value) : value;
  }

  private static escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private static escapeAttribute(text: string): string {
    return SvgWriter.escapeText(text).replace(/"/g, '&quot;');
  }
}
