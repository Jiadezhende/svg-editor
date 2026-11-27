import activateCore from '../../plugins/core/index';
import coreManifest from '../../plugins/core/package.json' with { type: 'json' };
import { buildCommandTable, createAssembler, readPluginManifest } from '../../src/bootstrap';
import type { ContributionNames, PluginContributions } from '../../src/bootstrap';
import { Client } from '../../src/backend';
import type { Receiver } from '../../src/backend';

export interface PluginRegistration {
  readonly name: string;
  readonly contributes: ContributionNames;
  readonly classes: Partial<PluginContributions>;
}

/** 测试直接提供分类后的类，复用 CLI 的校验和注册。 */
export function assemblePlugins(plugins: readonly PluginRegistration[], report: (message: string) => void = () => {}) {
  const empty: PluginContributions = { shapes: [], commands: [], attributes: [], decorators: [] };
  const assembler = createAssembler(report);
  for (const registration of plugins) {
    let manifest: ReturnType<typeof readPluginManifest>;
    try {
      manifest = readPluginManifest(registration);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      assembler.recordPluginError(reason);
      continue;
    }
    assembler.registerPlugin(manifest, { ...empty, ...registration.classes });
  }
  return assembler.getAssemblyResult();
}

let core: Promise<PluginRegistration> | null = null;

/** 使用发行包的真实清单和贡献，每次装配独立会话。 */
export function corePlugin(): Promise<PluginRegistration> {
  if (core !== null) return core;
  core = Promise.resolve({ ...readPluginManifest(coreManifest), classes: activateCore() });
  return core;
}

export async function createHost(extra: readonly PluginRegistration[] = []) {
  const host = assemblePlugins([await corePlugin(), ...extra]);
  if (host.errors.length) throw new Error(host.errors.join('\n'));
  return host;
}

export async function createReceiver() { return (await createHost()).receiver; }
export async function createShapeFactory() { return (await createHost()).factory; }
export async function createClient() { return (await createHost()).client; }

/** 以测试提供的 Receiver 装配指定命令。 */
export function createClientWithCommands(receiver: Receiver, commands: PluginContributions['commands']): Client {
  const table = buildCommandTable(commands.map((definition) => ({
    definition,
    create: (args) => new definition(receiver, args),
  })));
  return new Client(table, (kind) => receiver.notifyTree(kind));
}
