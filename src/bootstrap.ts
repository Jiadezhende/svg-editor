import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AttributeHandlerRegistry, Client, Command, Shape, ShapeFactory, SvgReader, SvgWriter, TreeDecorator, TreeRenderer, Workspace,
} from './backend';
import SvgFile from './backend/receiver/svg/SvgFile';
import type { AttributeHandler, SvgShapeMapping } from './backend';

type ShapeClass = Parameters<ShapeFactory['register']>[0];
type CommandClass = Parameters<Client['register']>[0];
type DecoratorClass = NonNullable<ConstructorParameters<typeof TreeRenderer>[0]>[number];
type ShapeRegistration = { readonly model: ShapeClass; readonly mapping?: SvgShapeMapping };

export interface PluginClasses {
  readonly shapes: readonly ShapeRegistration[];
  readonly commands: readonly CommandClass[];
  readonly attributes: readonly AttributeHandler[];
  readonly decorators: readonly DecoratorClass[];
}

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

const contributionExtensions = new Set(['.ts', '.mts', '.js', '.mjs']);

/** 按目录名发现应用 plugins/ 的直接子包，并扫描各包根目录的默认导出。 */
export async function bootstrapEditor(
  directory = fileURLToPath(new URL('../plugins/', import.meta.url)),
  report: (message: string) => void = (message) => { process.stderr.write(`${message}\n`); },
) {
  const sources: PluginSource[] = [];
  const discoveryErrors: string[] = [];
  const recordDiscoveryError = (message: string) => { discoveryErrors.push(message); report(`error: ${message}`); };

  // 按目录名排序，确定插件的装配顺序。
  let directories: string[];
  try {
    directories = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') recordDiscoveryError(`cannot discover plugins: ${directory}`);
    directories = [];
  }

  // 读取各包清单，收集可加载的插件来源。
  for (const entry of directories) {
    const pluginDirectory = join(directory, entry);
    const manifestPath = join(pluginDirectory, 'package.json');
    let text: string;
    try { text = await readFile(manifestPath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') recordDiscoveryError(`cannot read plugin manifest: ${manifestPath}`);
      continue;
    }
    try {
      const manifest = JSON.parse(text) as { name?: unknown; contributes?: unknown };
      if (typeof manifest.name !== 'string' || !manifest.name.trim() ||
          typeof manifest.contributes !== 'object' || manifest.contributes === null || Array.isArray(manifest.contributes)) {
        throw new Error('name or contributes is invalid');
      }
      sources.push({
        name: manifest.name,
        directory: pluginDirectory,
        contributes: manifest.contributes as Contributions,
      });
    } catch (error) {
      recordDiscoveryError(`invalid plugin manifest: ${manifestPath} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // 逐包加载贡献并注册，单包失败后继续处理其余插件。
  const assembler = createAssembler(report);
  for (const source of sources) {
    let classes: PluginClasses;
    try {
      classes = await loadPlugin(source.directory);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      assembler.recordPluginError(`plugin failed to load: ${source.name} (${reason})`);
      continue;
    }
    assembler.registerPlugin(source, classes);
  }

  const result = assembler.getAssemblyResult();
  return { ...result, errors: Object.freeze([...discoveryErrors, ...result.errors]) };
}

/** 按文件名顺序导入包根目录的文件，返回分类后的类和附属 SVG 映射。 */
export async function loadPlugin(directory: string): Promise<PluginClasses> {
  // 筛选包根目录的贡献文件，按文件名确定加载顺序。
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => {
      const { name } = entry;
      return entry.isFile() && !name.startsWith('.') && !name.endsWith('.d.ts') &&
        !name.includes('.test.') && !name.startsWith('index.') && contributionExtensions.has(extname(name));
    })
    .map((entry) => entry.name)
    .sort();

  // 导入各模块，校验并分类其贡献。
  const shapes: ShapeRegistration[] = [];
  const commands: CommandClass[] = [];
  const attributes: AttributeHandler[] = [];
  const decorators: DecoratorClass[] = [];
  for (const file of files) {
    const path = join(directory, file);
    const module = await import(/* @vite-ignore */ pathToFileURL(path).href) as Record<string, unknown>;
    const exported = module.default;
    if (typeof exported !== 'function') throw new Error(`plugin contribution must be a class: ${file}`);

    if (exported.prototype instanceof Shape) {
      const mapping = module.mapping as SvgShapeMapping | undefined;
      if (mapping !== undefined && (typeof mapping !== 'object' || mapping === null ||
        typeof mapping.matches !== 'function' || typeof mapping.write !== 'function')) {
        throw new Error(`invalid SVG mapping: ${file}`);
      }
      shapes.push({ model: exported as ShapeClass, mapping });
    } else if (exported.prototype instanceof Command) {
      commands.push(exported as CommandClass);
    } else if (exported.prototype instanceof TreeDecorator) {
      decorators.push(exported as DecoratorClass);
    } else {
      const handler = exported as unknown as AttributeHandler;
      if (typeof handler.handlerName !== 'string' || handler.handlerName.trim() === '' ||
        typeof handler.matches !== 'function' || typeof handler.apply !== 'function' ||
        handler.apply === (Function.prototype.apply as unknown) || typeof handler.display !== 'function') {
        throw new Error(`unsupported plugin contribution: ${file}`);
      }
      attributes.push(handler);
    }
  }
  return { shapes, commands, attributes, decorators };
}

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

  function registerPlugin(source: PluginManifest, classes: PluginClasses): void {
    // 检查插件包名是否有效且唯一。
    if (typeof source.name !== 'string' || !source.name.trim()) {
      recordPluginError('invalid plugin name');
      return;
    }

    if (accepted.some((registered) => registered.name === source.name)) {
      recordPluginError(`duplicate registration: plugins/${source.name}`);
      return;
    }

    try {
      // 按类别核对清单声明与实际导出的贡献。
      const actual: Record<Category, readonly string[]> = {
        shapes: classes.shapes.map(({ model }) => model.type),
        commands: [...new Set(classes.commands.map((command) => command.command))],
        attributes: classes.attributes.map((handler) => handler.handlerName),
        decorators: classes.decorators.map((decorator) => decorator.decoratorName),
      };
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

      // 构建候选会话，成功后再接纳插件并替换当前会话。
      const plugin = { ...classes, name: source.name };
      const candidate = buildSession([...accepted, plugin]);
      accepted.push(plugin);
      session = candidate;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const isRegistrationError = reason.startsWith('duplicate registration:') ||
        reason.startsWith('plugin manifest mismatch:');
      recordPluginError(isRegistrationError ? reason : `plugin failed to register: ${source.name} (${reason})`);
    }
  }

  function getAssemblyResult() {
    return { ...session, errors: Object.freeze([...errors]), plugins: Object.freeze(accepted.map((plugin) => plugin.name)) };
  }

  return { registerPlugin, recordPluginError, getAssemblyResult };
}

function buildSession(plugins: readonly RegisteredPlugin[]) {
  // 装配图形、SVG 映射、属性处理器和树装饰器。
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

  // 构建编辑器会话，再注册命令。
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
