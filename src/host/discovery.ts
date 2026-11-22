import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleSources } from './PluginHost';
import type { Contributions, PluginSource } from './PluginHost';

/** 按目录名发现应用 plugins/ 的直接子包，并扫描各包根目录的默认导出。 */
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
    const pluginDirectory = join(directory, entry);
    const manifestPath = join(pluginDirectory, 'package.json');
    let text: string;
    try { text = await readFile(manifestPath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') fail(`cannot read plugin manifest: ${manifestPath}`);
      continue;
    }
    try {
      const manifest = JSON.parse(text) as { name?: unknown; contributes?: unknown };
      if (typeof manifest.name !== 'string' || !manifest.name.trim() ||
          typeof manifest.contributes !== 'object' || manifest.contributes === null || Array.isArray(manifest.contributes)) {
        throw new Error('name or contributes is invalid');
      }
      sources.push({
        name: manifest.name,
        directory: pluginDirectory,
        contributes: manifest.contributes as Contributions,
      });
    } catch (error) {
      fail(`invalid plugin manifest: ${manifestPath} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  const result = await assembleSources(sources, report);
  return { ...result, errors: Object.freeze([...discoveryErrors, ...result.errors]) };
}
