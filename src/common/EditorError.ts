/**
 * 编辑器异常：用户输入或业务校验不成立时抛出，消息即一句问题描述。
 * 由 App 捕获后以 `error: <消息>` 输出；其他异常视为程序缺陷，不在此列。
 */
export default class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorError';
  }
}
