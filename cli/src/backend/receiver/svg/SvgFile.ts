import { readFileSync, writeFileSync } from 'node:fs';
import EditorError from '../../error/EditorError';

/** SVG 文件的读写（UTF-8）；失败时报 `cannot read file` / `cannot write file`。 */
export default class SvgFile {
  read(path: string): string {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      throw new EditorError(`cannot read file: ${path}`);
    }
  }

  write(path: string, text: string): void {
    try {
      writeFileSync(path, text, 'utf8');
    } catch {
      throw new EditorError(`cannot write file: ${path}`);
    }
  }
}
