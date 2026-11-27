import * as vscode from 'vscode';
import SvgPath from '../SvgPath';

export type FileStatReader = (uri: vscode.Uri) => Thenable<vscode.FileStat>;

/**
 * 只提供 Explorer 的附加标记，不修改资源。
 * 目录通过文件类型排除，因此名为 `assets.svg` 的目录也不会被标记。
 */
export default class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  constructor(
    private readonly readStat: FileStatReader = (uri) => vscode.workspace.fs.stat(uri),
  ) {}

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (!SvgPath.isSvg(uri.path)) return undefined;
    try {
      const stat = await this.readStat(uri);
      if ((stat.type & vscode.FileType.Directory) !== 0) return undefined;
      return new vscode.FileDecoration('[]', 'SVG file');
    } catch {
      return undefined;
    }
  }
}
