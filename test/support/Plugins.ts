import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPluginAssembler } from '../../src/host/PluginHost';
import type { Contributions } from '../../src/host/PluginHost';
import { scanPlugin } from '../../src/host/scan';
import type { PluginClasses } from '../../src/host/scan';

export interface PluginRegistration {
  readonly name: string;
  readonly contributes: Contributions;
  readonly classes: Partial<PluginClasses>;
}

/** 测试直接提供分类后的类，复用 CLI 扫描之后的校验和注册。 */
export function assemblePlugins(plugins: readonly PluginRegistration[], report: (message: string) => void = () => {}) {
  const empty: PluginClasses = { shapes: [], commands: [], attributes: [], decorators: [] };
  const assembler = createPluginAssembler(report);
  for (const registration of plugins) {
    assembler.register(registration, { ...empty, ...registration.classes });
  }
  return assembler.result();
}

let core: Promise<PluginRegistration> | null = null;

/** 使用发行包的真实清单和自动扫描入口，每次装配独立会话。 */
export function corePlugin(): Promise<PluginRegistration> {
  if (core !== null) return core;
  const root = fileURLToPath(new URL('../../plugins/core/', import.meta.url));
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; contributes: Contributions };
  core = scanPlugin(root).then((classes) => ({ ...manifest, classes }));
  return core;
}

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = assemblePlugins([await corePlugin(), ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}

export async function createWorkspace() { return (await createHost()).workspace; }
export async function createShapeFactory() { return (await createWorkspace()).shapes(); }
export async function createClient() { return (await createHost()).client; }
