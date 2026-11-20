import { AttributeHandlerRegistry, TreeRenderer, Client, ShapeFactory, Workspace, SvgReader, SvgWriter } from '../backend';
import SvgFile from '../backend/receiver/svg/SvgFile';
import Rect from '../../plugins/shapes/Rect';
import Circle from '../../plugins/shapes/Circle';
import Ellipse from '../../plugins/shapes/Ellipse';
import Line from '../../plugins/shapes/Line';
import Text from '../../plugins/shapes/Text';
import Group from '../../plugins/shapes/Group';
import AddtoCommand from '../../plugins/commands/AddtoCommand';
import BackCommand from '../../plugins/commands/BackCommand';
import CanvasResizeCommand from '../../plugins/commands/CanvasResizeCommand';
import CanvasShowCommand from '../../plugins/commands/CanvasShowCommand';
import CreateCommand from '../../plugins/commands/CreateCommand';
import DeleteCommand from '../../plugins/commands/DeleteCommand';
import FrontCommand from '../../plugins/commands/FrontCommand';
import GroupCommand from '../../plugins/commands/GroupCommand';
import InitCommand from '../../plugins/commands/InitCommand';
import MoveCommand from '../../plugins/commands/MoveCommand';
import ReadCommand from '../../plugins/commands/ReadCommand';
import SaveCommand from '../../plugins/commands/SaveCommand';
import ScaleCommand from '../../plugins/commands/ScaleCommand';
import SetCommand from '../../plugins/commands/SetCommand';
import ShowCommand from '../../plugins/commands/ShowCommand';
import TreeCommand from '../../plugins/commands/TreeCommand';
import UngroupCommand from '../../plugins/commands/UngroupCommand';

/** 默认内置能力由宿主选择；工厂本身不知道具体图形。 */
export function createShapeFactory(): ShapeFactory {
  const factory = new ShapeFactory();
  for (const cls of [Rect, Circle, Ellipse, Line, Text, Group]) factory.register(cls);
  return factory;
}

export function createWorkspace(): Workspace {
  const factory = createShapeFactory();
  return new Workspace(factory, new SvgFile(), new SvgReader(factory), new SvgWriter(), new AttributeHandlerRegistry(), new TreeRenderer());
}

export function createClient(): Client {
  const client = new Client(createWorkspace());
  registerBuiltinCommands(client);
  return client;
}

/** 默认内置实现由宿主提供，供基础装配和自动发现装配共用。 */
export function registerBuiltinCommands(client: Client): ReadonlySet<string> {
  const names = new Set<string>();
  // 保持原入口按文件名排序的 help 顺序，不在内核维护默认命令表。
  for (const cls of [
    AddtoCommand, BackCommand, CanvasResizeCommand, CanvasShowCommand, CreateCommand,
    DeleteCommand, FrontCommand, GroupCommand, InitCommand, MoveCommand, ReadCommand,
    SaveCommand, ScaleCommand, SetCommand, ShowCommand, TreeCommand, UngroupCommand,
  ]) {
    client.register(cls);
    names.add(cls.command);
  }
  return names;
}
