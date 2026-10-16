import { describe, expect, it } from 'vitest';
import Invoker from '../../../src/backend/invoker/Invoker';
import Workspace from '../../../src/backend/receiver/workspace/Workspace';
import StubCommand from '../../support/StubCommand';

describe('Invoker', () => {
  it('执行命令并返回其结果', () => {
    const result = new Invoker().execute(new StubCommand(new Workspace(), ['a', '1', 'warn']));
    expect(result.warnings()).toEqual(['stub a warned']);
    expect(result.lines()).toEqual(['a 1']);
  });
});
