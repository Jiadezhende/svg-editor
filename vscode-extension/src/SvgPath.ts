/** `.svg` 路径判断；只按扩展名识别，不读取文件内容。 */
export default class SvgPath {
  static isSvg(path: string): boolean {
    return path.toLowerCase().endsWith('.svg');
  }
}
