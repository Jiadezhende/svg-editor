import { DOMParser, type Element } from '@xmldom/xmldom';
import EditorError from '../../error/EditorError';
import DecimalFormat from '../../utils/DecimalFormat';
import type ShapeNode from '../document/ShapeNode';
import Document, { type ViewBox } from '../document/Document';
import type ShapeFactory from '../document/shape/ShapeFactory';
import Shape from '../document/shape/Shape';

/** Reader 暂存的文档关系，不向模型暴露。 */
type ParsedShape = { readonly shape: Shape; readonly children: readonly ParsedShape[] };

/** 读入结果：新文档，以及读入过程中产生的警告（按出现顺序）。 */
export type SvgReadResult = { readonly document: Document; readonly warnings: readonly string[] };

/**
 * XML、类型选择及递归由 Reader 编排；领域属性解析和部件构造委托已注册 Shape.parse。
 * 优先选择已安装的 data-kind，否则按原标签降级；仅将模型返回的成员组装为文档节点。
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
    const used = SvgReader.ids(root);
    const warnings: string[] = [];
    const roots = this.children(root, used, warnings);
    const append = (parsed: ParsedShape, parent: ShapeNode | null): void => {
      const node = document.insert(parsed.shape, parent);
      for (const child of parsed.children) append(child, node);
    };
    for (const parsed of roots) append(parsed, null);
    return { document, warnings };
  }

  /** 按需递归，先构造有效模型和候选关系，之后统一加入候选 Document。 */
  private children(element: Element, used: Set<string>, warnings: string[]): ParsedShape[] {
    const result: ParsedShape[] = [];
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== node.ELEMENT_NODE) {
        continue;
      }
      const child = node as Element;
      const tag = child.localName ?? child.tagName;
      const kind = child.getAttribute('data-kind');
      const type = kind !== null && this.factory.has(kind) ? kind : tag;
      if (!this.factory.has(type)) {
        warnings.push(`skipped unsupported <${tag}>`);
        continue;
      }
      const definition = this.factory.definition(type);
      const id = child.getAttribute('id') ?? SvgReader.assign(tag, used, warnings);
      const attributes = new Map(Array.from(child.attributes).map((attribute) => [attribute.name, attribute.value.trim()]));
      if (definition.content !== null) attributes.set(definition.content, child.textContent ?? '');
      let children: ParsedShape[] | null = null;
      const readChildren = (): readonly Shape[] => {
        children ??= this.children(child, used, warnings);
        return children.map((entry) => entry.shape);
      };
      const parsed = this.factory.parse(type, id, attributes, readChildren);
      if (parsed.shape.id() !== id) throw new EditorError(`parsed shape id mismatch: ${id}`);
      const available = new Map((children ?? []).map((entry: ParsedShape) => [entry.shape, entry]));
      const retained = new Set<Shape>();
      const remaining = parsed.children.map((shape) => {
        const entry = available.get(shape);
        if (entry === undefined || retained.has(shape)) throw new EditorError(`invalid parsed children: ${id}`);
        retained.add(shape);
        return entry;
      });
      for (const entry of available.values()) {
        if (!retained.has(entry.shape) && entry.children.length > 0) {
          throw new EditorError(`internal part has document children: ${entry.shape.id()}`);
        }
      }
      result.push({ shape: parsed.shape, children: remaining });
    }
    return result;
  }

  /** 校验整份输入，包括私有部件及被跳过的子树；同时预留全部显式 id。 */
  private static ids(root: Element): Set<string> {
    const ids = new Set<string>();
    for (const element of [root, ...Array.from(root.getElementsByTagName('*'))]) {
      const id = element.getAttribute('id');
      if (id === null) continue;
      Shape.checkId(id);
      if (ids.has(id)) throw new EditorError(`id already exists: ${id}`);
      ids.add(id);
    }
    return ids;
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
