import { readFileSync } from 'node:fs';
import * as commands from '../../plugins/commands';
import * as shapes from '../../plugins/shapes';
import { assemblePlugins } from '../../src/host/PluginHost';
import type { ExtensionPlugin } from '../../src/backend';
import type { Contributions } from '../../src/host/PluginHost';
import type { PluginRegistration } from '../../src/host/PluginHost';

/** 使用发行包的真实声明和激活入口，每次装配独立会话。 */
function registration(directory: string, plugin: ExtensionPlugin): PluginRegistration {
  const manifest = JSON.parse(readFileSync(new URL(`../../plugins/${directory}/package.json`, import.meta.url), 'utf8')) as { name: string; contributes: Contributions };
  return { name: manifest.name, contributes: manifest.contributes, plugin };
}

export const shippedPlugins: readonly PluginRegistration[] = [
  registration('commands', commands), registration('shapes', shapes),
];

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = await assemblePlugins([...shippedPlugins, ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}

export async function createWorkspace() { return (await createHost()).workspace; }
export async function createShapeFactory() { return (await createWorkspace()).shapes(); }
export async function createClient() { return (await createHost()).client; }
