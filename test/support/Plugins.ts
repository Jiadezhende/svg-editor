import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionPlugin } from '../../src/backend';
import { assembleSources } from '../../src/host/PluginHost';
import type { Contributions } from '../../src/host/PluginHost';
import { scanPlugin } from '../../src/host/scan';

export interface PluginRegistration {
  readonly name: string;
  readonly contributes: Contributions;
  readonly plugin: ExtensionPlugin;
}

/** 测试直接传入插件对象，再交给 CLI 使用的 assembleSources 处理。 */
export function assemblePlugins(plugins: readonly PluginRegistration[], report: (message: string) => void = () => {}) {
  return assembleSources(plugins.map(({ name, contributes, plugin }) => ({
    name,
    contributes,
    module: name,
    load: async () => plugin,
  })), report);
}

let core: Promise<PluginRegistration> | null = null;

/** 使用发行包的真实清单和自动扫描入口，每次装配独立会话。 */
export function corePlugin(): Promise<PluginRegistration> {
  if (core !== null) return core;
  const root = fileURLToPath(new URL('../../plugins/core/', import.meta.url));
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; contributes: Contributions };
  core = scanPlugin(root).then((plugin) => ({ name: manifest.name, contributes: manifest.contributes, plugin }));
  return core;
}

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = await assemblePlugins([await corePlugin(), ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}

export async function createWorkspace() { return (await createHost()).workspace; }
export async function createShapeFactory() { return (await createWorkspace()).shapes(); }
export async function createClient() { return (await createHost()).client; }
