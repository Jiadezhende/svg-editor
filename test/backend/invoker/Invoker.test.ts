import { describe, expect, it } from 'vitest';
import Invoker from '../../../src/backend/invoker/Invoker';
import CommandResult from '../../../src/backend/command/CommandResult';
import DocumentCommand from '../../../src/backend/command/DocumentCommand';
import EditCommand from '../../../src/backend/command/EditCommand';
import EditorError from '../../../src/backend/error/EditorError';
import Workspace from '../../../src/backend/receiver/workspace/Workspace';
import StubCommand from '../../support/StubCommand';

/** 测试用接收者：一个计数器。 */
class Counter {
  value = 0;
}

/** 编辑命令：给计数器加 n；n 为负时执行失败。 */
class AddCommand extends EditCommand {
  constructor(
    private readonly counter: Counter,
    private readonly n: number,
  ) {
    super();
  }

  execute(): CommandResult {
    if (this.n < 0) {
      throw new EditorError('negative');
    }
    this.counter.value += this.n;
    return new CommandResult().line(`added ${this.n}`);
  }

  undo(): CommandResult {
    this.counter.value -= this.n;
    return new CommandResult().line(`removed ${this.n}`);
  }
}

/** 文档类命令：什么都不改，只用于触发禁止。 */
class SaveLikeCommand extends DocumentCommand {
  execute(): CommandResult {
    return new CommandResult().line('saved');
  }
}

function display(): StubCommand {
  return new StubCommand(new Workspace(), ['a', '1']);
}

describe('Invoker 执行', () => {
  it('执行命令并返回其结果', () => {
    const result = new Invoker().execute(new StubCommand(new Workspace(), ['a', '1', 'warn']));
    expect(result.warnings()).toEqual(['stub a warned']);
    expect(result.lines()).toEqual(['a 1']);
  });
});

describe('Invoker 撤销与重做', () => {
  it('undo 撤销最近一个编辑命令，redo 再次执行，回显与原命令相同', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.execute(new AddCommand(counter, 10));
    expect(invoker.undo().lines()).toEqual(['removed 10']);
    expect(counter.value).toBe(1);
    expect(invoker.undo().lines()).toEqual(['removed 1']);
    expect(counter.value).toBe(0);
    expect(invoker.redo().lines()).toEqual(['added 1']);
    expect(invoker.redo().lines()).toEqual(['added 10']);
    expect(counter.value).toBe(11);
  });

  it('栈为空时报无可撤销 / 无可重做', () => {
    const invoker = new Invoker();
    expect(() => invoker.undo()).toThrow(new EditorError('nothing to undo'));
    expect(() => invoker.redo()).toThrow(new EditorError('nothing to redo'));
  });

  it('undo 后执行新的编辑命令，重做栈清空', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.undo();
    invoker.execute(new AddCommand(counter, 2));
    expect(() => invoker.redo()).toThrow('nothing to redo');
    expect(invoker.undo().lines()).toEqual(['removed 2']);
  });

  it('编辑命令执行失败：不入栈，不清空重做栈，不改变禁止状态', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.undo();
    expect(() => invoker.execute(new AddCommand(counter, -1))).toThrow('negative');
    expect(invoker.redo().lines()).toEqual(['added 1']);

    invoker.execute(new SaveLikeCommand());
    expect(() => invoker.execute(new AddCommand(counter, -1))).toThrow('negative');
    expect(() => invoker.undo()).toThrow('undo not allowed after io command');
  });

  it('文档类命令后禁止 undo / redo，且清空了之前的历史', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.execute(new AddCommand(counter, 2));
    invoker.undo();
    invoker.execute(new SaveLikeCommand());
    expect(() => invoker.undo()).toThrow(new EditorError('undo not allowed after io command'));
    expect(() => invoker.redo()).toThrow(new EditorError('redo not allowed after io command'));
  });

  it('文档类命令后执行一次成功的编辑命令即解禁，只能撤销之后的编辑', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.execute(new SaveLikeCommand());
    invoker.execute(new AddCommand(counter, 5));
    expect(invoker.undo().lines()).toEqual(['removed 5']);
    expect(() => invoker.undo()).toThrow('nothing to undo');
    expect(counter.value).toBe(1);
  });

  it('显示类命令不影响历史：不入栈、不清空重做栈、不解除禁止', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.execute(display());
    invoker.undo();
    invoker.execute(display());
    expect(invoker.redo().lines()).toEqual(['added 1']);

    invoker.execute(new SaveLikeCommand());
    invoker.execute(display());
    expect(() => invoker.undo()).toThrow('undo not allowed after io command');
  });

  it('undo / redo 交替时，撤销栈与重做栈之间正确移动', () => {
    const counter = new Counter();
    const invoker = new Invoker();
    invoker.execute(new AddCommand(counter, 1));
    invoker.undo();
    invoker.redo();
    invoker.undo();
    expect(counter.value).toBe(0);
    expect(() => invoker.undo()).toThrow('nothing to undo');
  });
});
