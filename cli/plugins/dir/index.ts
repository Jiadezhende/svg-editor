import { Command, CommandResult, EditorError } from '../../src/backend';
import type { PluginContributions, Receiver } from '../../src/backend';
import { NodeDirectoryAccess } from './DirectoryAccess';
import type { DirectoryAccess, DirectoryEntry } from './DirectoryAccess';

export class DirCommand extends Command {
  static override readonly command = 'dir';
  static override readonly usage = 'dir';

  constructor(
    _receiver: Receiver,
    args: readonly string[],
    private readonly directory: DirectoryAccess = new NodeDirectoryAccess(),
  ) {
    super();
    this.expectArgCount(args, 0);
  }

  execute(): CommandResult {
    const path = this.directory.currentDirectory();
    let entries: readonly DirectoryEntry[];
    try {
      entries = this.directory.read(path);
    } catch {
      throw new EditorError(`cannot read directory: ${path}`);
    }

    const sorted = entries
      .filter(({ name }) => name !== '.' && name !== '..')
      .sort((a, b) => {
        if (a.directory !== b.directory) return a.directory ? -1 : 1;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });

    const result = new CommandResult();
    if (sorted.length === 0) return result.line('(empty directory)');
    for (const { name, directory } of sorted) {
      result.line(`${directory ? '[DIR]' : '[FILE]'}  ${name}`);
    }
    return result;
  }
}

export default function activate(): PluginContributions {
  return { shapes: [], commands: [DirCommand], attributes: [], decorators: [] };
}
