import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, Shape, TreeDecorator } from '../backend';
import type { AttributeHandler, ExtensionContext, ExtensionPlugin, SvgShapeMapping } from '../backend';

type ShapeClass = Parameters<ExtensionContext['registerShape']>[0];
type CommandClass = Parameters<ExtensionContext['registerCommand']>[0];
type DecoratorClass = Parameters<ExtensionContext['registerTreeDecorator']>[0];

const contributionExtensions = new Set(['.ts', '.mts', '.js', '.mjs']);

/** 包根目录下每个参与扫描的文件贡献一个默认导出类。 */
function isContributionFile(name: string): boolean {
  if (name.startsWith('.') || name.endsWith('.d.ts') || name.includes('.test.')) return false;
  if (name.startsWith('index.')) return false;
  return contributionExtensions.has(extname(name));
}

/**
 * 扫描包根目录并生成标准插件入口：按文件名稳定排序，默认导出必须是四类贡献之一。
 * 仍然只通过 ExtensionContext 暂存注册，装配、重名和清单校验由宿主原有路径完成。
 */
export async function scanPlugin(directory: string): Promise<ExtensionPlugin> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && isContributionFile(entry.name))
    .map((entry) => entry.name)
    .sort();
  const contributions: ((context: ExtensionContext) => void)[] = [];
  for (const file of files) {
    const path = join(directory, file);
    const module = await import(/* @vite-ignore */ pathToFileURL(path).href) as Record<string, unknown>;
    contributions.push(contributionOf(module.default, module, file));
  }
  return {
    activate(context: ExtensionContext): void {
      for (const register of contributions) register(context);
    },
  };
}

function contributionOf(value: unknown, module: Record<string, unknown>, file: string): (context: ExtensionContext) => void {
  if (typeof value !== 'function') throw new Error(`plugin contribution must be a class: ${file}`);
  if (value.prototype instanceof Shape) {
    const mapping = module.mapping;
    if (mapping !== undefined && !isMapping(mapping)) throw new Error(`invalid SVG mapping: ${file}`);
    return (context) => context.registerShape(value as ShapeClass, mapping as SvgShapeMapping | undefined);
  }
  if (value.prototype instanceof Command) return (context) => context.registerCommand(value as CommandClass);
  if (value.prototype instanceof TreeDecorator) return (context) => context.registerTreeDecorator(value as DecoratorClass);
  if (isAttributeHandler(value)) return (context) => context.registerAttributeHandler(value as unknown as AttributeHandler);
  throw new Error(`unsupported plugin contribution: ${file}`);
}

function isAttributeHandler(value: Function): boolean {
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
