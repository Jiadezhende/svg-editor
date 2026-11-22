import {
  AttributeHandlerRegistry, Client, Command, Shape, ShapeFactory, SvgReader, SvgWriter, TreeRenderer, Workspace,
} from '../backend';
import SvgFile from '../backend/receiver/svg/SvgFile';
import { scanPlugin } from './scan';
import type { PluginClasses } from './scan';

type Category = keyof PluginClasses;
export type Contributions = Partial<Record<Category, readonly string[]>>;
interface PluginManifest {
  readonly name: string;
  readonly contributes: Contributions;
}
export interface PluginSource extends PluginManifest {
  readonly directory: string;
}
type RegisteredPlugin = PluginClasses & { readonly name: string };

function build(plugins: readonly RegisteredPlugin[]) {
  const factory = new ShapeFactory();
  const writer = new SvgWriter();
  const handlers = new AttributeHandlerRegistry();
  const decorators: PluginClasses['decorators'][number][] = [];
  const attributeNames = new Set<string>();
  const decoratorNames = new Set<string>();
  for (const plugin of plugins) {
    for (const { model, mapping } of plugin.shapes) {
      if (typeof model !== 'function' || !(model.prototype instanceof Shape) || typeof model.parse !== 'function') throw new Error('shape must extend Shape and provide parse');
      if (factory.has(model.type)) throw new Error(`duplicate registration: shapes/${model.type}`);
      factory.register(model);
      if (mapping !== undefined) {
        if (typeof mapping.matches !== 'function' || typeof mapping.write !== 'function') throw new Error('invalid SVG mapping');
        writer.register(mapping);
      }
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
  const workspace = new Workspace(factory, new SvgFile(), new SvgReader(factory), writer, handlers, new TreeRenderer(decorators));
  const client = new Client(workspace);
  const commandNames = new Set(['help', 'undo', 'redo', 'exit', 'quit']);
  for (const plugin of plugins) {
    const local = new Set<string>();
    for (const command of plugin.commands) {
      if (typeof command !== 'function' || !(command.prototype instanceof Command) || typeof command.accepts !== 'function') throw new Error('command must extend Command and provide accepts');
      if (commandNames.has(command.command)) throw new Error(`duplicate registration: commands/${command.command}`);
      client.register(command);
      local.add(command.command);
    }
    for (const name of local) commandNames.add(name);
  }
  return { workspace, client };
}

function names(plugin: PluginClasses): Record<Category, readonly string[]> {
  return {
    shapes: plugin.shapes.map(({ model }) => model.type),
    commands: [...new Set(plugin.commands.map((command) => command.command))],
    attributes: plugin.attributes.map((handler) => handler.handlerName),
    decorators: plugin.decorators.map((decorator) => decorator.decoratorName),
  };
}

function validateManifest(source: PluginManifest, classes: PluginClasses): void {
  const actual = names(classes);
  const declared = source.contributes;
  if (typeof declared !== 'object' || declared === null || Array.isArray(declared)) throw new Error('invalid contribution declaration');
  for (const category of Object.keys(declared)) {
    if (!(category in actual)) throw new Error(`unknown contribution category: ${category}`);
  }
  for (const category of Object.keys(actual) as Category[]) {
    const expected = declared[category] ?? [];
    if (!Array.isArray(expected) || expected.some((name) => typeof name !== 'string' || !name.trim()) || new Set(expected).size !== expected.length) {
      throw new Error(`invalid contribution declaration: ${category}`);
    }
    const registered = actual[category];
    if (expected.length !== new Set(registered).size || expected.some((name) => !registered.includes(name))) {
      throw new Error(`plugin manifest mismatch: ${source.name} (declared: ${category}/${expected.join(',')}; registered: ${category}/${registered.join(',')})`);
    }
  }
}

/** 逐包校验并注册已加载的插件。每次都在新宿主里注册，成功后才换用新宿主。 */
export function createPluginAssembler(report: (message: string) => void) {
  const accepted: RegisteredPlugin[] = [];
  const errors: string[] = [];
  // 没有插件注册成功时，返回只提供框架命令的宿主。
  let session = build(accepted);
  const fail = (message: string) => {
    errors.push(message);
    report(`error: ${message}`);
  };

  function register(source: PluginManifest, classes: PluginClasses): void {
    if (typeof source.name !== 'string' || !source.name.trim()) {
      fail('invalid plugin name');
      return;
    }

    if (accepted.some((registered) => registered.name === source.name)) {
      fail(`duplicate registration: plugins/${source.name}`);
      return;
    }

    try {
      validateManifest(source, classes);
      const plugin = { ...classes, name: source.name };
      const candidate = build([...accepted, plugin]);
      // 新宿主创建成功后，才把当前插件记为注册成功，并换用新宿主。
      accepted.push(plugin);
      session = candidate;
    } catch (error) {
      const reason = messageOf(error);
      const isRegistrationError = reason.startsWith('duplicate registration:') ||
        reason.startsWith('plugin manifest mismatch:');
      fail(isRegistrationError ? reason : `plugin failed to register: ${source.name} (${reason})`);
    }
  }

  function result() {
    return { ...session, errors: Object.freeze([...errors]), plugins: Object.freeze(accepted.map((plugin) => plugin.name)) };
  }

  return { register, fail, result };
}

/** 按输入顺序扫描各包目录。某个包扫描失败时，记录错误并继续扫描下一个。 */
export async function assembleSources(sources: readonly PluginSource[], report: (message: string) => void) {
  const assembler = createPluginAssembler(report);
  for (const source of sources) {
    let classes: PluginClasses;
    try {
      classes = await scanPlugin(source.directory);
    } catch (error) {
      assembler.fail(`plugin failed to load: ${source.name} (${messageOf(error)})`);
      continue;
    }
    assembler.register(source, classes);
  }
  return assembler.result();
}

function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
