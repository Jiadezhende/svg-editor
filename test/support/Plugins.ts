import { readFileSync } from 'node:fs';
import commands from '../../plugins/commands';
import shapes from '../../plugins/shapes';
import { assemblePlugins } from '../../src/host/PluginHost';
import type { PluginRegistration } from '../../src/host/PluginHost';

/** 使用发行包的真实声明和激活入口，每次装配独立会话。 */
export const shippedPlugins: readonly PluginRegistration[] = [
  ['commands', commands], ['shapes', shapes],
].map(([name, plugin]) => ({
  ...JSON.parse(readFileSync(new URL(`../../plugins/${name}/package.json`, import.meta.url), 'utf8')),
  plugin,
}));

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = await assemblePlugins([...shippedPlugins, ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}
