/** 不透明结构快照；恢复闭包绑定原 Document，不复制 Shape 属性。 */
export default class DocumentStructureMemento {
  constructor(private readonly restoreAction: () => void) {}

  restore(): void {
    this.restoreAction();
  }
}
