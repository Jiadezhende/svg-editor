import type { ExtensionContext } from '../../src/backend';
import AddtoCommand from './AddtoCommand';
import BackCommand from './BackCommand';
import CanvasResizeCommand from './CanvasResizeCommand';
import CanvasShowCommand from './CanvasShowCommand';
import CreateCommand from './CreateCommand';
import DeleteCommand from './DeleteCommand';
import FrontCommand from './FrontCommand';
import GroupCommand from './GroupCommand';
import InitCommand from './InitCommand';
import MoveCommand from './MoveCommand';
import ReadCommand from './ReadCommand';
import SaveCommand from './SaveCommand';
import ScaleCommand from './ScaleCommand';
import SetCommand from './SetCommand';
import ShowCommand from './ShowCommand';
import TreeCommand from './TreeCommand';
import UngroupCommand from './UngroupCommand';

export function activate(context: ExtensionContext): void {
  context.registerCommand(AddtoCommand);
  context.registerCommand(BackCommand);
  context.registerCommand(CanvasResizeCommand);
  context.registerCommand(CanvasShowCommand);
  context.registerCommand(CreateCommand);
  context.registerCommand(DeleteCommand);
  context.registerCommand(FrontCommand);
  context.registerCommand(GroupCommand);
  context.registerCommand(InitCommand);
  context.registerCommand(MoveCommand);
  context.registerCommand(ReadCommand);
  context.registerCommand(SaveCommand);
  context.registerCommand(ScaleCommand);
  context.registerCommand(SetCommand);
  context.registerCommand(ShowCommand);
  context.registerCommand(TreeCommand);
  context.registerCommand(UngroupCommand);
}
