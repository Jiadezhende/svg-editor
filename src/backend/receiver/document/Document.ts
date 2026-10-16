import EditorError from '../../error/EditorError';

/** viewBox 的四个分量：min-x、min-y、width、height。 */
type ViewBox = readonly [number, number, number, number];

/**
 * 当前文档：画布尺寸与 viewBox，图形树随 create 加入。
 * 不变量：画布宽高须为正数，校验失败时状态不变。
 */
export default class Document {
  private canvasWidth: number;
  private canvasHeight: number;
  private readonly canvasViewBox: ViewBox;

  /** 新建文档，viewBox 为 `0 0 w h`。 */
  constructor(width: number, height: number) {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvasViewBox = [0, 0, width, height];
  }

  width(): number {
    return this.canvasWidth;
  }

  height(): number {
    return this.canvasHeight;
  }

  viewBox(): ViewBox {
    return this.canvasViewBox;
  }

  /** 修改画布尺寸，不改动 viewBox。 */
  resize(width: number, height: number): void {
    Document.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  private static checkSize(width: number, height: number): void {
    if (!(width > 0 && height > 0)) {
      throw new EditorError('canvas size must be positive');
    }
  }
}
