/**
 * 前端解析错误：输入行无法解析为命令时抛出（如引号未闭合），消息即一句问题描述。
 * 由 App 捕获后以 `error: <消息>` 输出。
 */
export default class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
