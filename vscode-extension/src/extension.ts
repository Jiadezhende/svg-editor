import * as vscode from 'vscode';
import SvgFileDecorationProvider from './decoration/SvgFileDecorationProvider';
import SvgDocumentSymbolProvider from './outline/SvgDocumentSymbolProvider';

/**
 * VS Code 只负责在启动时调用一次 activate。
 * 之后由 Explorer 和 Outline 按需回调两个 provider；扩展不轮询文档或文件系统。
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new SvgFileDecorationProvider()),
    vscode.languages.registerDocumentSymbolProvider(
      { pattern: '**/*.svg' },
      new SvgDocumentSymbolProvider(),
    ),
  );
}

export function deactivate(): void {
  // 注册项都在 context.subscriptions 中，由 VS Code 统一释放。
}
