import { readFile, stat } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPluginManifest } from './bootstrap';
import type { createAssembler, PluginManifest } from './bootstrap';
import type { ActivatePlugin, PluginOptions } from './backend';

type PluginConfigEntry = { module: string; enabled?: boolean; options?: PluginOptions };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPluginEntry(value: unknown): value is PluginConfigEntry {
  return isObject(value) && Object.keys(value).every((key) => ['module', 'enabled', 'options'].includes(key)) &&
    typeof value.module === 'string' && value.module.trim() !== '' &&
    (!Object.hasOwn(value, 'enabled') || typeof value.enabled === 'boolean') &&
    (!Object.hasOwn(value, 'options') || isObject(value.options));
}

async function readConfig(path: string): Promise<readonly PluginConfigEntry[]> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isObject(value) || Object.keys(value).length !== 1 || !Array.isArray(value.plugins) ||
    !value.plugins.every(isPluginEntry)) throw new Error('invalid plugin config');
  return value.plugins;
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ERR_MODULE_NOT_FOUND';
}

async function readManifest(path: string): Promise<{ manifest: PluginManifest; main: unknown }> {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  return { manifest: readPluginManifest(raw), main: raw.main };
}

async function resolvePlugin(specifier: string, base: URL): Promise<{ manifest: PluginManifest; url: string } | null> {
  if (/^\.\.?[/\\]/.test(specifier) || isAbsolute(specifier)) {
    const target = resolve(dirname(fileURLToPath(base)), specifier);
    const entry = await stat(target).catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
    if (entry === null) return null;
    if (entry.isDirectory()) {
      const { manifest, main } = await readManifest(resolve(target, 'package.json'));
      if (typeof main !== 'string' || !main.trim()) throw new Error('plugin package must declare main');
      return { manifest, url: pathToFileURL(resolve(target, main)).href };
    }
    const manifestPath = findPackageJSON(pathToFileURL(target));
    if (manifestPath === undefined) throw new Error('plugin has no package.json');
    return { manifest: (await readManifest(manifestPath)).manifest, url: pathToFileURL(target).href };
  }

  let manifestPath: string | undefined;
  try {
    manifestPath = findPackageJSON(specifier, base);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (manifestPath === undefined) return null;
  const { manifest } = await readManifest(manifestPath);
  return { manifest, url: import.meta.resolve(specifier, base.href) };
}

export async function loadPluginConfig(
  assembler: ReturnType<typeof createAssembler>,
  path: string,
  registerDefaults: () => Promise<void>,
): Promise<void> {
  const configPath = resolve(path);
  let entries: readonly PluginConfigEntry[];
  try {
    entries = await readConfig(configPath);
  } catch {
    assembler.recordPluginError('invalid plugin config');
    await registerDefaults();
    return;
  }

  const base = pathToFileURL(configPath);
  for (const entry of entries) {
    if (entry.enabled === false) continue;
    let name = entry.module;
    try {
      const plugin = await resolvePlugin(entry.module, base);
      if (plugin === null) {
        assembler.recordPluginError(`plugin not found: ${entry.module}`);
        continue;
      }
      name = plugin.manifest.name;
      const imported = await import(/* @vite-ignore */ plugin.url) as { default?: unknown };
      if (!Object.hasOwn(imported, 'default')) {
        assembler.recordPluginError(`plugin has no default export: ${entry.module}`);
        continue;
      }
      if (typeof imported.default !== 'function') throw new Error('default export must be an activate function');
      assembler.registerPlugin(plugin.manifest, imported.default as ActivatePlugin, entry.options);
    } catch (error) {
      assembler.recordPluginError(`plugin failed to load: ${name} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}
