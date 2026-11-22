import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemblePlugins } from '../../src/host/PluginHost';
import type { Contributions, PluginRegistration } from '../../src/host/PluginHost';
import { scanPlugin } from '../../src/host/scan';

let shipped: Promise<readonly PluginRegistration[]> | null = null;

/** 使用发行包的真实清单和自动扫描入口，每次装配独立会话。 */
export function shippedPlugins(): Promise<readonly PluginRegistration[]> {
  return shipped ??= Promise.all(['commands', 'shapes'].map(async (directory) => {
    const root = fileURLToPath(new URL(`../../plugins/${directory}/`, import.meta.url));
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; contributes: Contributions };
    return { name: manifest.name, contributes: manifest.contributes, plugin: await scanPlugin(root) };
  }));
}

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = await assemblePlugins([...(await shippedPlugins()), ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}

export async function createWorkspace() { return (await createHost()).workspace; }
export async function createShapeFactory() { return (await createWorkspace()).shapes(); }
export async function createClient() { return (await createHost()).client; }
