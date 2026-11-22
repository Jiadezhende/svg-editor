import type { CommandForm } from './Client';
import type Command from './command/Command';
import type Receiver from './receiver/Receiver';
import type AttributeHandler from './receiver/document/shape/AttributeHandler';
import type Shape from './receiver/document/shape/Shape';
import type { SvgShapeMapping } from './receiver/svg/SvgWriter';
import type TreeDecorator from './receiver/tree/TreeDecorator';

export type CommandContribution = CommandForm['definition'] &
  (new (receiver: Receiver, args: readonly string[]) => Command);

export interface PluginContributions {
  readonly shapes: readonly {
    readonly model: typeof Shape;
    readonly mapping?: SvgShapeMapping;
  }[];
  readonly commands: readonly CommandContribution[];
  readonly attributes: readonly AttributeHandler[];
  readonly decorators: readonly (typeof TreeDecorator)[];
}

export type PluginOptions = Readonly<Record<string, unknown>>;
export type ActivatePlugin = (options: PluginOptions) => PluginContributions;
