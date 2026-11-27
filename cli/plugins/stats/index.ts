import { Command, CommandResult } from '../../src/backend';
import type { PluginContributions, Receiver, ShapeView } from '../../src/backend';

export class StatsCommand extends Command {
  static override readonly command = 'stats';
  static override readonly usage = 'stats';

  constructor(private readonly receiver: Pick<Receiver, 'document'>, args: readonly string[]) {
    super();
    this.expectArgCount(args, 0);
  }

  execute(): CommandResult {
    const counts = new Map<string, number>();
    let total = 0;
    let containers = 0;

    const visit = (shape: ShapeView): void => {
      if (shape.container) {
        containers += 1;
        shape.children.forEach(visit);
      } else {
        counts.set(shape.type, (counts.get(shape.type) ?? 0) + 1);
        total += 1;
      }
    };
    this.receiver.document().shapeViews().forEach(visit);
    const lines = [...counts].map(([type, count]) => `${type}: ${count}`);
    lines.push(`(total ${total}, containers ${containers})`);
    return new CommandResult().line(lines.join('  '));
  }
}

export default function activate(): PluginContributions {
  return { shapes: [], commands: [StatsCommand], attributes: [], decorators: [] };
}
