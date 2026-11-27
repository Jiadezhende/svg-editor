/**
 * 仅供 Vitest 使用的最小 VS Code API 替身。
 * 真实 provider 仍然按 @types/vscode 编译，运行时替换为这些值即可测试适配逻辑。
 */
export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

export class Range {
  constructor(
    readonly start: Position,
    readonly end: Position,
  ) {}
}

export enum SymbolKind {
  Module = 2,
  Object = 19,
}

export class DocumentSymbol {
  children: DocumentSymbol[] = [];

  constructor(
    readonly name: string,
    readonly detail: string,
    readonly kind: SymbolKind,
    readonly range: Range,
    readonly selectionRange: Range,
  ) {}
}

export class FileDecoration {
  constructor(
    readonly badge?: string,
    readonly tooltip?: string,
  ) {}
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface Uri {
  readonly path: string;
}

export interface FileStat {
  readonly type: FileType;
}

export interface Disposable {
  dispose(): void;
}

export interface ExtensionContext {
  subscriptions: Disposable[];
}

export const registrations = {
  decorationProviders: [] as unknown[],
  symbolProviders: [] as unknown[],
};

export const workspace = {
  fs: {
    stat: async (_uri: Uri): Promise<FileStat> => ({ type: FileType.File }),
  },
};

export const window = {
  registerFileDecorationProvider(provider: unknown): Disposable {
    registrations.decorationProviders.push(provider);
    return { dispose: () => undefined };
  },
};

export const languages = {
  registerDocumentSymbolProvider(_selector: unknown, provider: unknown): Disposable {
    registrations.symbolProviders.push(provider);
    return { dispose: () => undefined };
  },
};
