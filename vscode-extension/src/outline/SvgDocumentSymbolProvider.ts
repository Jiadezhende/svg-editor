import * as vscode from 'vscode';
import SvgPath from '../SvgPath';
import SvgElementNode from './SvgElementNode';
import SvgSourceParser from './SvgSourceParser';

/** 把只依赖 offset 的语法树适配为 VS Code 原生 Outline 的 DocumentSymbol 树。 */
export default class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private readonly parser = new SvgSourceParser();

  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    if (token.isCancellationRequested || !SvgPath.isSvg(document.uri.path)) return [];
    try {
      return this.parser.parse(document.getText()).map((node) => this.symbol(document, node));
    } catch {
      // 编辑中的异常输入不能影响扩展宿主；下一次合法文本会重新生成符号。
      return [];
    }
  }

  private symbol(document: vscode.TextDocument, node: SvgElementNode): vscode.DocumentSymbol {
    const range = new vscode.Range(
      document.positionAt(node.start()),
      document.positionAt(node.end()),
    );
    const selectionRange = new vscode.Range(
      document.positionAt(node.nameStart()),
      document.positionAt(node.nameEnd()),
    );
    const symbol = new vscode.DocumentSymbol(
      node.name(),
      '',
      node.children().length > 0 ? vscode.SymbolKind.Module : vscode.SymbolKind.Object,
      range,
      selectionRange,
    );
    symbol.children = node.children().map((child) => this.symbol(document, child));
    return symbol;
  }
}
