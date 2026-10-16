import type InputSource from '../../src/frontend/io/InputSource';

/** 内存输入源：按顺序提供预置的行，用尽后视为 EOF。 */
export default class MemoryInputSource implements InputSource {
  private readonly pending: string[];

  constructor(
    lines: readonly string[],
    readonly interactive = false,
  ) {
    this.pending = [...lines];
  }

  async next(): Promise<string | null> {
    return this.pending.shift() ?? null;
  }

  /** 尚未被读取的行数。 */
  remaining(): number {
    return this.pending.length;
  }
}
