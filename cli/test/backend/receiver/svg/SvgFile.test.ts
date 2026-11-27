import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import EditorError from '../../../../src/backend/error/EditorError';
import SvgFile from '../../../../src/backend/receiver/svg/SvgFile';

describe('SvgFile', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'svg-file-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('以 UTF-8 写入并读回', () => {
    const path = join(dir, 'a.svg');
    new SvgFile().write(path, '开始 <svg/>');
    expect(readFileSync(path, 'utf8')).toBe('开始 <svg/>');
    expect(new SvgFile().read(path)).toBe('开始 <svg/>');
  });

  it('文件不存在时报 cannot read file', () => {
    const path = join(dir, 'missing.svg');
    expect(() => new SvgFile().read(path)).toThrow(new EditorError(`cannot read file: ${path}`));
  });

  it('不可写（目录不存在）时报 cannot write file', () => {
    const path = join(dir, 'no-such-dir', 'a.svg');
    expect(() => new SvgFile().write(path, 'x')).toThrow(new EditorError(`cannot write file: ${path}`));
  });
});
