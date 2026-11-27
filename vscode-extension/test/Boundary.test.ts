import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function typescriptFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...typescriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(path);
  }
  return result;
}

function source(directory: string): string {
  return typescriptFiles(directory).map((path) => readFileSync(path, 'utf8')).join('\n');
}

describe('package boundary', () => {
  it('扩展源码不引用 CLI 的 src 或 plugins', () => {
    const extensionSource = source(resolve('src'));
    expect(extensionSource).not.toMatch(/(?:from|require\s*\()\s*['"][^'"]*(?:\/src\/|plugins\/)/);
  });

  it('CLI 源码不引用 vscode', () => {
    const cliSource = source(resolve('..', 'cli', 'src')) + source(resolve('..', 'cli', 'plugins'));
    expect(cliSource).not.toMatch(/(?:from|require\s*\()\s*['"]vscode['"]/);
  });
});
