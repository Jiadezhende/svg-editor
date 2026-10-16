/**
 * 一条命令的执行结果：分别收集警告与结果行，按加入顺序读取。
 * 输出格式（`warning:` 前缀、先警告后结果）由前端决定，后端只管收集。
 */
export default class CommandResult {
  private readonly warningList: string[] = [];
  private readonly lineList: string[] = [];

  warn(message: string): this {
    this.warningList.push(message);
    return this;
  }

  line(text: string): this {
    this.lineList.push(text);
    return this;
  }

  warnings(): readonly string[] {
    return this.warningList;
  }

  lines(): readonly string[] {
    return this.lineList;
  }
}
