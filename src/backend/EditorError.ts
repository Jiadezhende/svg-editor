/**
 * 后端异常：命令无法执行（未知命令、参数格式、业务校验不成立）时抛出，消息即一句问题描述。
 * 由 App 捕获后以 `error: <消息>` 输出；其他异常视为程序缺陷，不在此列。
 */
export default class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorError';
  }
}
