import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import { FileType } from 'vscode';
import SvgFileDecorationProvider from '../src/decoration/SvgFileDecorationProvider';

const uri = (path: string): vscode.Uri => ({ path }) as vscode.Uri;

describe('SvgFileDecorationProvider', () => {
  it('只给 SVG 文件返回 [] 标记', async () => {
    const provider = new SvgFileDecorationProvider(async () => ({ type: FileType.File } as vscode.FileStat));
    const decoration = await provider.provideFileDecoration(uri('/workspace/example.svg'));
    expect(decoration?.badge).toBe('[]');
  });

  it('普通文件不标记', async () => {
    const provider = new SvgFileDecorationProvider(async () => ({ type: FileType.File } as vscode.FileStat));
    expect(await provider.provideFileDecoration(uri('/workspace/notes.txt'))).toBeUndefined();
  });

  it('目录即使名为 .svg 也不标记', async () => {
    const provider = new SvgFileDecorationProvider(async () => ({ type: FileType.Directory } as vscode.FileStat));
    expect(await provider.provideFileDecoration(uri('/workspace/assets.svg'))).toBeUndefined();
  });

  it('扩展名大小写不敏感', async () => {
    const provider = new SvgFileDecorationProvider(async () => ({ type: FileType.File } as vscode.FileStat));
    expect((await provider.provideFileDecoration(uri('/workspace/EXAMPLE.SVG')))?.badge).toBe('[]');
  });

  it('文件状态读取失败时不标记也不抛错', async () => {
    const provider = new SvgFileDecorationProvider(async () => {
      throw new Error('not found');
    });
    expect(await provider.provideFileDecoration(uri('/workspace/missing.svg'))).toBeUndefined();
  });
});
