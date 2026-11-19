import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleSources } from './PluginHost';
import type { Contributions, PluginSource } from './PluginHost';

/** 只发现应用 plugins/ 下的直接子包，按目录名稳定排序；目录不存在表示无附加插件。 */
export async function createDiscoveredHost(
  directory = fileURLToPath(new URL('../../plugins/', import.meta.url)),
  report: (message: string) => void = (message) => { process.stderr.write(`${message}\n`); },
) {
  const sources: PluginSource[] = [];
  const discoveryErrors: string[] = [];
  const fail = (message: string) => { discoveryErrors.push(message); report(`error: ${message}`); };
  let directories: string[];
  try {
    directories = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') fail(`cannot discover plugins: ${directory}`);
    directories = [];
  }
  for (const entry of directories) {
    const manifestPath = join(directory, entry, 'package.json');
    let text: string;
    try { text = await readFile(manifestPath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') fail(`cannot read plugin manifest: ${manifestPath}`);
      continue;
    }
    try {
      const manifest = JSON.parse(text) as { name?: unknown; main?: unknown; contributes?: unknown };
      if (typeof manifest.name !== 'string' || !manifest.name.trim() ||
          (manifest.main !== undefined && typeof manifest.main !== 'string') ||
          typeof manifest.contributes !== 'object' || manifest.contributes === null || Array.isArray(manifest.contributes)) {
        throw new Error('name, main or contributes is invalid');
      }
      const module = resolve(directory, entry, manifest.main ?? 'index.js');
      try { if (!(await stat(module)).isFile()) throw new Error('not a file'); }
      catch { fail(`plugin not found: ${module}`); continue; }
      sources.push({
        name: manifest.name, module, contributes: manifest.contributes as Contributions,
        load: () => import(/* @vite-ignore */ pathToFileURL(module).href),
      });
    } catch (error) {
      fail(`invalid plugin manifest: ${manifestPath} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  const result = await assembleSources(sources, report);
  return { ...result, errors: Object.freeze([...discoveryErrors, ...result.errors]) };
}
