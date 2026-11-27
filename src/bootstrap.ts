import {
  AttributeHandlerRegistry, Client, Command, ShapeFactory, SvgFile, SvgReader, SvgWriter, TreeRenderer, Receiver,
  frameworkCommandNames,
} from './backend';
import type { ActivatePlugin, CommandForm, CommandTable, PluginContributions, PluginOptions } from './backend';

export type { PluginContributions } from './backend';

const contributionCategories = ['shapes', 'commands', 'attributes', 'decorators'] as const;
type Category = typeof contributionCategories[number];

export type ContributionNames = Partial<Record<Category, readonly string[]>>;

export interface PluginManifest {
  readonly name: string;
  readonly contributes: ContributionNames;
}

/** 校验磁盘或代码提供的清单，仅取清单自己的字段。 */
export function readPluginManifest(value: unknown): PluginManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid plugin manifest');
  const { name, contributes } = value as Partial<Record<keyof PluginManifest, unknown>>;
  if (!Object.hasOwn(value, 'name') || typeof name !== 'string' || !name.trim()) throw new Error('invalid plugin name');
  if (!Object.hasOwn(value, 'contributes') || typeof contributes !== 'object' || contributes === null || Array.isArray(contributes)) {
    throw new Error('invalid contribution declaration');
  }

  for (const key of Object.keys(contributes)) {
    if (!contributionCategories.some((category) => category === key)) throw new Error(`unknown contribution category: ${key}`);
  }
  const names: ContributionNames = {};
  for (const category of contributionCategories) {
    if (!Object.hasOwn(contributes, category)) continue;
    const declared: unknown = (contributes as Record<string, unknown>)[category];
    if (!Array.isArray(declared)) throw new Error(`invalid contribution declaration: ${category}`);
    const entries = [...declared];
    if (entries.some((name) => typeof name !== 'string' || !name.trim()) || new Set(entries).size !== entries.length) {
      throw new Error(`invalid contribution declaration: ${category}`);
    }
    names[category] = entries;
  }
  return { name, contributes: names };
}

type RegisteredPlugin = PluginContributions & { readonly name: string };

/** 逐包校验并注册已加载的插件。每次都在新宿主里注册，成功后才换用新宿主。 */
export function createAssembler(report: (message: string) => void) {
  const accepted: RegisteredPlugin[] = [];
  const errors: string[] = [];
  // 没有插件注册成功时，返回只提供框架命令的宿主。
  let session = buildSession(accepted);
  const recordPluginError = (message: string) => {
    errors.push(message);
    report(`error: ${message}`);
  };

  /** 清单由磁盘或代码入口通过 readPluginManifest 校验。 */
  function registerPlugin(
    manifest: PluginManifest,
    source: PluginContributions | ActivatePlugin,
    options: PluginOptions = {},
  ): void {
    const { name, contributes: declared } = manifest;
    if (accepted.some((registered) => registered.name === name)) {
      recordPluginError(`duplicate registration: plugins/${name}`);
      return;
    }

    let contributions: PluginContributions;
    try {
      contributions = typeof source === 'function' ? source(options) : source;
    } catch (error) {
      recordPluginError(`plugin failed to activate: ${name} (${error instanceof Error ? error.message : String(error)})`);
      return;
    }

    try {
      // 按类别核对清单声明与实际提供的贡献。
      const actual: Required<ContributionNames> = {
        shapes: contributions.shapes.map((model) => model.type),
        commands: [...new Set(contributions.commands.map((command) => command.command))],
        attributes: contributions.attributes.map((handler) => handler.handlerName),
        decorators: contributions.decorators.map((decorator) => decorator.decoratorName),
      };
      for (const category of contributionCategories) {
        const expected = declared[category] ?? [];
        const registered = new Set(actual[category]);
        if (expected.length !== registered.size || expected.some((name) => !registered.has(name))) {
          throw new Error(`plugin manifest mismatch: ${name} (declared: ${category}/${expected.join(',')}; registered: ${category}/${actual[category].join(',')})`);
        }
      }

      // 构建候选会话，成功后再接纳插件并替换当前会话。
      const plugin = { ...contributions, name };
      const candidate = buildSession([...accepted, plugin]);
      accepted.push(plugin);
      session = candidate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const isRegistrationError = reason.startsWith('duplicate registration:') ||
        reason.startsWith('plugin manifest mismatch:');
      recordPluginError(isRegistrationError ? reason : `plugin failed to register: ${name} (${reason})`);
    }
  }

  function getAssemblyResult() {
    return { ...session, errors: Object.freeze([...errors]), plugins: Object.freeze(accepted.map((plugin) => plugin.name)) };
  }

  return { registerPlugin, recordPluginError, getAssemblyResult };
}

/** 将已绑定的命令按名称分组，校验后交给分发器。 */
export function buildCommandTable(forms: readonly CommandForm[]): CommandTable {
  const reserved = new Set<string>(frameworkCommandNames);
  const table = new Map<string, CommandForm[]>();
  for (const form of forms) {
    const { definition } = form;
    const { command, usage } = definition;
    if (reserved.has(command)) throw new Error(`duplicate registration: commands/${command}`);
    if (!command || !usage) {
      throw new Error(`command class ${definition.name} must declare static command and usage`);
    }
    const existing = table.get(command) ?? [];
    if (existing.some((entry) => entry.definition === definition)) {
      throw new Error(`duplicate command: ${command}`);
    }
    const next = [...existing, form];
    if (next.length > 1 && next.some((entry) => entry.definition.accepts === Command.accepts)) {
      throw new Error(`command ${command} has multiple forms; each must override static accepts`);
    }
    table.set(command, next);
  }
  return table;
}

function buildSession(plugins: readonly RegisteredPlugin[]) {
  // 装配图形、SVG 映射、属性处理器和树装饰器。
  const factory = new ShapeFactory();
  const writer = new SvgWriter();
  const handlers = new AttributeHandlerRegistry();
  const decorators: PluginContributions['decorators'][number][] = [];
  const attributeNames = new Set<string>();
  const decoratorNames = new Set<string>();
  for (const plugin of plugins) {
    for (const model of plugin.shapes) {
      const type = model?.type;
      if (type && factory.has(type)) throw new Error(`duplicate registration: shapes/${type}`);
      factory.register(model);
    }
    for (const handler of plugin.attributes) {
      if (attributeNames.has(handler.handlerName)) throw new Error(`duplicate registration: attributes/${handler.handlerName}`);
      handlers.register(handler);
      attributeNames.add(handler.handlerName);
    }
    for (const decorator of plugin.decorators) {
      if (decoratorNames.has(decorator.decoratorName)) throw new Error(`duplicate registration: decorators/${decorator.decoratorName}`);
      decoratorNames.add(decorator.decoratorName);
      decorators.push(decorator);
    }
  }

  const receiver = new Receiver(factory, new SvgFile(), new SvgReader(factory), writer, handlers, new TreeRenderer(decorators));
  const forms: CommandForm[] = [];
  const commandNames = new Set<string>();
  for (const plugin of plugins) {
    const local = new Set<string>();
    for (const command of plugin.commands) {
      if (typeof command !== 'function' || !(command.prototype instanceof Command) || typeof command.accepts !== 'function') throw new Error('command must extend Command and provide accepts');
      if (forms.some((form) => form.definition === command) || commandNames.has(command.command)) throw new Error(`duplicate registration: commands/${command.command}`);
      forms.push({ definition: command, create: (args) => new command(receiver, args) });
      local.add(command.command);
    }
    for (const name of local) commandNames.add(name);
  }
  const client = new Client(buildCommandTable(forms), (kind) => receiver.notifyTree(kind));
  return { receiver, client, factory, handlers, writer };
}
