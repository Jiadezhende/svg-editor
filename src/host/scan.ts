import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, Shape, TreeDecorator } from '../backend';
import type { AttributeHandler, Client, ShapeFactory, SvgShapeMapping, TreeRenderer } from '../backend';

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

const contributionExtensions = new Set(['.ts', '.mts', '.js', '.mjs']);

/** 包根目录下每个参与扫描的文件贡献一个默认导出类。 */
function isContributionFile(name: string): boolean {
  if (name.startsWith('.') || name.endsWith('.d.ts') || name.includes('.test.')) return false;
  if (name.startsWith('index.')) return false;
  return contributionExtensions.has(extname(name));
}

/** 按文件名顺序导入包根目录的文件，返回分类后的类和附属 SVG 映射。 */
export async function scanPlugin(directory: string): Promise<PluginClasses> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && isContributionFile(entry.name))
    .map((entry) => entry.name)
    .sort();
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
      const mapping = module.mapping;
      if (mapping !== undefined && !isMapping(mapping)) throw new Error(`invalid SVG mapping: ${file}`);
      shapes.push({ model: exported as ShapeClass, mapping });
    } else if (exported.prototype instanceof Command) {
      commands.push(exported as CommandClass);
    } else if (exported.prototype instanceof TreeDecorator) {
      decorators.push(exported as DecoratorClass);
    } else if (isAttributeHandler(exported)) {
      attributes.push(exported);
    } else {
      throw new Error(`unsupported plugin contribution: ${file}`);
    }
  }
  return { shapes, commands, attributes, decorators };
}

function isAttributeHandler(value: Function): value is Function & AttributeHandler {
  const candidate = value as unknown as AttributeHandler;
  return typeof candidate.handlerName === 'string' && candidate.handlerName.trim() !== '' &&
    typeof candidate.matches === 'function' && typeof candidate.apply === 'function' &&
    candidate.apply !== (Function.prototype.apply as unknown) && typeof candidate.display === 'function';
}

function isMapping(value: unknown): value is SvgShapeMapping {
  if (typeof value !== 'object' || value === null) return false;
  const mapping = value as SvgShapeMapping;
  return typeof mapping.matches === 'function' && typeof mapping.write === 'function';
}
