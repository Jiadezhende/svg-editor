import { readdirSync } from 'node:fs';

export interface DirectoryEntry {
  readonly name: string;
  readonly directory: boolean;
}

export interface DirectoryAccess {
  currentDirectory(): string;
  read(path: string): readonly DirectoryEntry[];
}

export class NodeDirectoryAccess implements DirectoryAccess {
  constructor(private readonly cwd = process.cwd()) {}

  currentDirectory(): string { return this.cwd; }

  read(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      directory: entry.isDirectory(),
    }));
  }
}
