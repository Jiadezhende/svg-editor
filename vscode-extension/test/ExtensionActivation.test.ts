import { beforeEach, describe, expect, it } from 'vitest';
import * as stub from './support/VSCodeApi';
import { activate } from '../src/extension';

describe('extension activation', () => {
  beforeEach(() => {
    stub.registrations.decorationProviders.length = 0;
    stub.registrations.symbolProviders.length = 0;
  });

  it('注册文件标记和大纲 provider，并加入 subscriptions', () => {
    const subscriptions: stub.Disposable[] = [];
    activate({ subscriptions } as unknown as import('vscode').ExtensionContext);

    expect(stub.registrations.decorationProviders).toHaveLength(1);
    expect(stub.registrations.symbolProviders).toHaveLength(1);
    expect(subscriptions).toHaveLength(2);
  });
});
