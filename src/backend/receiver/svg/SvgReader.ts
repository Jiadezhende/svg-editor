import { DOMParser, type Element } from '@xmldom/xmldom';
import EditorError from '../../error/EditorError';
import type { AttributeValue } from '../document/attribute/AttributeSpec';
import DecimalFormat from '../document/attribute/DecimalFormat';
import type Container from '../document/Container';
import Document, { type ViewBox } from '../document/Document';
import type { ShapeClass } from '../document/shape/ShapeFactory';
import type ShapeFactory from '../document/shape/ShapeFactory';

/** 读入结果：新文档，以及读入过程中产生的警告（按出现顺序）。 */
export type SvgReadResult = { readonly document: Document; readonly warnings: readonly string[] };

/**
 * 把 SVG 文本读成文档。按图形类的声明通用处理：元素名经图形工厂取图形类，属性经属性种类解析与校验，
 * `content` 属性取自子文本，容器递归子元素。
 *
 * - 不支持的元素：警告并跳过（连同其子树）；未知属性：丢弃；缺少的必填属性：取属性种类的默认值；
 * - 缺 id 的图形按文档顺序分配 `<标签名><序号>`（跳过已占用的编号）并警告；
 * - 画布：width / height 取纯数字，缺失或解析不了时取 viewBox 的宽高，都没有时为 800×600；
 * - XML 非法、根不是 svg、取值非法、id 不合法或重复时报错，不产生文档。
 *
 * 唯一依赖 XML 解析库（@xmldom/xmldom）的类。
 */
export default class SvgReader {
  private static readonly decimal = new DecimalFormat();

  constructor(private readonly factory: ShapeFactory) {}

  read(text: string): SvgReadResult {
    const root = SvgReader.parse(text);
    if (root.localName !== 'svg') {
      throw new EditorError(`invalid svg: root element is <${root.localName}>, not <svg>`);
    }
    const document = SvgReader.canvas(root);
    const used = new Set(
      Array.from(root.getElementsByTagName('*')).flatMap((element) => element.getAttribute('id') ?? []),
    );
    const warnings: string[] = [];
    this.children(root, document, document, used, warnings);
    return { document, warnings };
  }

  /** 逐个读入 element 的子元素，加入 container。 */
  private children(element: Element, container: Container, document: Document, used: Set<string>, warnings: string[]): void {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== node.ELEMENT_NODE) {
        continue;
      }
      const child = node as Element;
      const tag = child.localName ?? child.tagName;
      const cls = this.factory.find(tag);
      if (cls === null) {
        warnings.push(`skipped unsupported <${tag}>`);
        continue;
      }
      const id = child.getAttribute('id') ?? SvgReader.assign(tag, used, warnings);
      const shape = new cls(id, SvgReader.values(cls, child));
      document.add(shape, container);
      const nested = shape.asContainer();
      if (nested !== null) {
        this.children(child, nested, document, used, warnings);
      }
    }
  }

  /** 按属性表读取元素的属性；`content` 属性取子文本；缺少的必填属性取默认值。 */
  private static values(cls: ShapeClass, element: Element): Map<string, AttributeValue> {
    const values = new Map<string, AttributeValue>();
    for (const spec of cls.attributes()) {
      const name = spec.name();
      const raw = name === cls.content ? (element.textContent ?? '') : element.getAttribute(name)?.trim() ?? null;
      if (raw !== null) {
        values.set(name, spec.parse(raw));
      } else if (cls.params.includes(spec)) {
        values.set(name, spec.defaultValue());
      }
    }
    return values;
  }

  /** 为缺 id 的图形分配 `<标签名><序号>`，序号从 1 起跳过已占用的。 */
  private static assign(tag: string, used: Set<string>, warnings: string[]): string {
    let n = 1;
    while (used.has(`${tag}${n}`)) {
      n += 1;
    }
    const id = `${tag}${n}`;
    used.add(id);
    warnings.push(`assigned id ${id} to unnamed <${tag}>`);
    return id;
  }

  private static canvas(root: Element): Document {
    const viewBox = SvgReader.viewBox(root);
    const width = SvgReader.number(root, 'width') ?? viewBox?.[2] ?? 800;
    const height = SvgReader.number(root, 'height') ?? viewBox?.[3] ?? 600;
    return new Document(width, height, viewBox ?? undefined);
  }

  /** 纯数字的属性值；缺失或解析不了时为 null（视为未声明）。 */
  private static number(element: Element, name: string): number | null {
    const raw = element.getAttribute(name);
    return raw === null ? null : SvgReader.decimal.tryParse(raw.trim());
  }

  /** 由 4 个数字组成的 viewBox；缺失或解析不了时为 null。 */
  private static viewBox(root: Element): ViewBox | null {
    const parts = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/);
    const numbers = parts.map((part) => SvgReader.decimal.tryParse(part));
    if (numbers.length !== 4 || numbers.some((n) => n === null)) {
      return null;
    }
    const [x, y, w, h] = numbers as number[];
    return [x, y, w, h];
  }

  /** 解析 XML，返回根元素；任何错误或警告以外的问题都使读入失败。 */
  private static parse(text: string): Element {
    const problems: string[] = [];
    let root: Element | null = null;
    try {
      const parser = new DOMParser({
        onError: (level, message) => {
          if (level !== 'warning') {
            problems.push(message.split('\n')[0].trim());
          }
        },
      });
      root = parser.parseFromString(text, 'image/svg+xml').documentElement;
    } catch {
      // 致命错误已由 onError 记录。
    }
    if (problems.length > 0 || root === null) {
      throw new EditorError(`invalid svg: ${problems[0] ?? 'missing root element'}`);
    }
    return root;
  }
}
