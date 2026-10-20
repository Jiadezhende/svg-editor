import Command from './Command';

/**
 * 文档类命令（init、read、save、修改画布尺寸）：执行成功后清空撤销 / 重做历史，
 * 并禁止 undo / redo，直到下一次编辑命令成功执行。规则由 Invoker 按本类型执行。
 */
export default abstract class DocumentCommand extends Command {}
