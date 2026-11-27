import type { PluginContributions } from '../../src/backend';
import AddtoCommand from './AddtoCommand';
import BackCommand from './BackCommand';
import CanvasResizeCommand from './CanvasResizeCommand';
import CanvasShowCommand from './CanvasShowCommand';
import Circle from './Circle';
import CreateCommand from './CreateCommand';
import DeleteCommand from './DeleteCommand';
import Ellipse from './Ellipse';
import FrontCommand from './FrontCommand';
import Group from './Group';
import GroupCommand from './GroupCommand';
import InitCommand from './InitCommand';
import Line from './Line';
import MoveCommand from './MoveCommand';
import ReadCommand from './ReadCommand';
import Rect from './Rect';
import SaveCommand from './SaveCommand';
import ScaleCommand from './ScaleCommand';
import SetCommand from './SetCommand';
import ShowCommand from './ShowCommand';
import Text from './Text';
import TreeCommand from './TreeCommand';
import UngroupCommand from './UngroupCommand';

export default function activate(): PluginContributions {
  return {
    shapes: [Circle, Ellipse, Group, Line, Rect, Text],
    commands: [
      AddtoCommand, BackCommand, CanvasResizeCommand, CanvasShowCommand, CreateCommand, DeleteCommand,
      FrontCommand, GroupCommand, InitCommand, MoveCommand, ReadCommand, SaveCommand, ScaleCommand,
      SetCommand, ShowCommand, TreeCommand, UngroupCommand,
    ],
    attributes: [],
    decorators: [],
  };
}
