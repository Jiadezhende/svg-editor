import {
  AttributeHandlerRegistry, Client, Command, Shape, ShapeFactory, SvgReader, SvgWriter, TreeRenderer, Workspace,
} from '../backend';
import type { AttributeHandler, ExtensionContext, ExtensionPlugin, SvgShapeMapping } from '../backend';
import SvgFile from '../backend/receiver/svg/SvgFile';

type Category = 'shapes' | 'commands' | 'attributes' | 'decorators';
export type Contributions = Partial<Record<Category, readonly string[]>>;
export interface PluginSource {
  readonly name: string;
  readonly module: string;
  readonly contributes: Contributions;
  load(): Promise<{ activate?: unknown }>;
}
type Staged = {
  name: string;
  shapes: { model: Parameters<ExtensionContext['registerShape']>[0]; mapping?: SvgShapeMapping }[];
  commands: Parameters<ExtensionContext['registerCommand']>[0][];
  attributes: AttributeHandler[];
  decorators: Parameters<ExtensionContext['registerTreeDecorator']>[0][];
};

function build(plugins: readonly Staged[]) {
  const factory = new ShapeFactory();
  const writer = new SvgWriter();
  const handlers = new AttributeHandlerRegistry();
  const decorators: Staged['decorators'] = [];
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

function names(plugin: Staged): Record<Category, readonly string[]> {
  return {
    shapes: plugin.shapes.map(({ model }) => model.type),
    commands: [...new Set(plugin.commands.map((command) => command.command))],
    attributes: plugin.attributes.map((handler) => handler.handlerName),
    decorators: plugin.decorators.map((decorator) => decorator.decoratorName),
  };
}

function validateManifest(source: PluginSource, staged: Staged): void {
  const actual = names(staged);
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

async function loadPlugin(source: PluginSource): Promise<ExtensionPlugin> {
  if (typeof source.name !== 'string' || !source.name.trim()) {
    throw new Error('invalid plugin name');
  }

  let module: { activate?: unknown };
  try {
    module = await source.load();
  } catch (error) {
    throw new Error(`plugin failed to load: ${source.name} (${messageOf(error)})`);
  }

  if (typeof module.activate !== 'function') {
    throw new Error(`plugin must export activate(context): ${source.module}`);
  }
  return module as ExtensionPlugin;
}

async function collectRegistrations(name: string, plugin: ExtensionPlugin): Promise<Staged> {
  const staged: Staged = { name, shapes: [], commands: [], attributes: [], decorators: [] };
  let registrationOpen = true;
  const checkOpen = () => {
    if (!registrationOpen) throw new Error('plugin registration is closed');
  };
  const context: ExtensionContext = Object.freeze({
    registerShape(model, mapping) {
      checkOpen();
      staged.shapes.push({ model, mapping });
    },
    registerCommand(command) {
      checkOpen();
      staged.commands.push(command);
    },
    registerAttributeHandler(handler) {
      checkOpen();
      staged.attributes.push(handler);
    },
    registerTreeDecorator(decorator) {
      checkOpen();
      staged.decorators.push(decorator);
    },
  } satisfies ExtensionContext);

  try {
    await plugin.activate(context);
    return staged;
  } finally {
    // 插件即使保留了 context，也只能在 activate 执行期间调用注册方法。
    registrationOpen = false;
  }
}

/**
 * 按输入顺序加载插件。先收集当前插件要注册的图形、SVG 映射、命令、属性处理器和树装饰器。
 * 核对注册名称与清单后，把当前插件和之前注册成功的插件一起重新组装成一套宿主。
 * 如果加载、检查或组装失败，记录错误，继续使用原来的宿主并处理下一个插件。
 */
export async function assembleSources(sources: readonly PluginSource[], report: (message: string) => void) {
  const accepted: Staged[] = [];
  const errors: string[] = [];
  // 没有插件注册成功时，返回只提供框架命令的宿主。
  let session = build(accepted);
  const fail = (message: string) => {
    errors.push(message);
    report(`error: ${message}`);
  };

  for (const source of sources) {
    let plugin: ExtensionPlugin;
    try {
      plugin = await loadPlugin(source);
    } catch (error) {
      fail(messageOf(error));
      continue;
    }

    if (accepted.some((registered) => registered.name === source.name)) {
      fail(`duplicate registration: plugins/${source.name}`);
      continue;
    }

    try {
      const staged = await collectRegistrations(source.name, plugin);
      validateManifest(source, staged);
      const candidate = build([...accepted, staged]);
      // 新宿主创建成功后，才把当前插件记为注册成功，并换用新宿主。
      accepted.push(staged);
      session = candidate;
    } catch (error) {
      const reason = messageOf(error);
      const isRegistrationError = reason.startsWith('duplicate registration:') ||
        reason.startsWith('plugin manifest mismatch:');
      fail(isRegistrationError ? reason : `plugin failed to activate: ${source.name} (${reason})`);
    }
  }
  return { ...session, errors: Object.freeze(errors), plugins: Object.freeze(accepted.map((plugin) => plugin.name)) };
}

function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
