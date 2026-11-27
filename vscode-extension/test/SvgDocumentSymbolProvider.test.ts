import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import SvgDocumentSymbolProvider from '../src/outline/SvgDocumentSymbolProvider';

class TestDocument {
  private readonly lines: readonly string[];

  constructor(readonly text: string) {
    this.lines = text.split('\n');
  }

  get uri(): vscode.Uri {
    return { path: '/workspace/example.svg' } as vscode.Uri;
  }

  getText(): string {
    return this.text;
  }

  positionAt(offset: number): vscode.Position {
    let line = 0;
    let lineStart = 0;
    for (let index = 0; index < this.lines.length; index += 1) {
      const lineEnd = lineStart + this.lines[index]!.length + 1;
      if (offset < lineEnd) {
        return { line, character: offset - lineStart } as vscode.Position;
      }
      line += 1;
      lineStart = lineEnd;
    }
    return { line: this.lines.length - 1, character: this.lines.at(-1)!.length } as vscode.Position;
  }
}

const document = (text: string): vscode.TextDocument => new TestDocument(text) as unknown as vscode.TextDocument;
const token = { isCancellationRequested: false } as vscode.CancellationToken;

describe('SvgDocumentSymbolProvider', () => {
  const provider = new SvgDocumentSymbolProvider();
  const text = [
    '<svg>',
    '  <g id="flowchart">',
    '    <rect id="start" />',
    '    <text>Start</text>',
    '  </g>',
    '</svg>',
  ].join('\n');

  it('生成层级、显示名和可定位的源码范围', () => {
    const symbols = provider.provideDocumentSymbols(document(text), token);
    expect(symbols).toHaveLength(1);
    const svg = symbols[0]!;
    expect(svg.name).toBe('svg');
    expect(svg.children).toHaveLength(1);
    expect(svg.children[0]!.name).toBe('g#flowchart');
    expect(svg.children[0]!.children.map((symbol) => symbol.name)).toEqual(['rect#start', 'text']);

    const rect = svg.children[0]!.children[0]!;
    expect(rect.selectionRange.start.line).toBe(2);
    expect(rect.selectionRange.start.character).toBe(5);
    expect(rect.range.start.line).toBe(2);
    expect(rect.range.end.line).toBe(2);
  });

  it('编辑后的文本生成新的名称和层级', () => {
    const symbols = provider.provideDocumentSymbols(
      document('<svg><g id="renamed"><rect id="next"/></g></svg>'),
      token,
    );
    expect(symbols[0]!.children[0]!.name).toBe('g#renamed');
    expect(symbols[0]!.children[0]!.children[0]!.name).toBe('rect#next');
  });

  it('空文本、不完整 XML 和取消请求返回空结果', () => {
    expect(provider.provideDocumentSymbols(document(''), token)).toEqual([]);
    expect(provider.provideDocumentSymbols(document('<svg><g>'), token)).toEqual([]);
    expect(provider.provideDocumentSymbols(document(text), {
      isCancellationRequested: true,
    } as vscode.CancellationToken)).toEqual([]);
  });
});
