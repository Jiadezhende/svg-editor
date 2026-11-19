import { AttributeHandlerRegistry, Client, ShapeFactory, Workspace, SvgReader, SvgWriter } from '../backend';
import SvgFile from '../backend/receiver/svg/SvgFile';
import Rect from '../backend/receiver/document/shape/Rect';
import Circle from '../backend/receiver/document/shape/Circle';
import Ellipse from '../backend/receiver/document/shape/Ellipse';
import Line from '../backend/receiver/document/shape/Line';
import Text from '../backend/receiver/document/shape/Text';
import Group from '../backend/receiver/document/shape/Group';
import AddtoCommand from '../backend/command/impl/AddtoCommand';
import BackCommand from '../backend/command/impl/BackCommand';
import CanvasResizeCommand from '../backend/command/impl/CanvasResizeCommand';
import CanvasShowCommand from '../backend/command/impl/CanvasShowCommand';
import CreateCommand from '../backend/command/impl/CreateCommand';
import DeleteCommand from '../backend/command/impl/DeleteCommand';
import FrontCommand from '../backend/command/impl/FrontCommand';
import GroupCommand from '../backend/command/impl/GroupCommand';
import InitCommand from '../backend/command/impl/InitCommand';
import MoveCommand from '../backend/command/impl/MoveCommand';
import ReadCommand from '../backend/command/impl/ReadCommand';
import SaveCommand from '../backend/command/impl/SaveCommand';
import ScaleCommand from '../backend/command/impl/ScaleCommand';
import SetCommand from '../backend/command/impl/SetCommand';
import ShowCommand from '../backend/command/impl/ShowCommand';
import TreeCommand from '../backend/command/impl/TreeCommand';
import UngroupCommand from '../backend/command/impl/UngroupCommand';

/** 默认内置能力由宿主选择；工厂本身不知道具体图形。 */
export function createShapeFactory(): ShapeFactory {
  const factory = new ShapeFactory();
  for (const cls of [Rect, Circle, Ellipse, Line, Text, Group]) factory.register(cls);
  return factory;
}

export function createWorkspace(): Workspace {
  const factory = createShapeFactory();
  return new Workspace(factory, new SvgFile(), new SvgReader(factory), new SvgWriter(), new AttributeHandlerRegistry());
}

export function createClient(): Client {
  const client = new Client(createWorkspace());
  // 保持原入口按文件名排序的 help 顺序，不在内核维护默认命令表。
  for (const cls of [
    AddtoCommand, BackCommand, CanvasResizeCommand, CanvasShowCommand, CreateCommand,
    DeleteCommand, FrontCommand, GroupCommand, InitCommand, MoveCommand, ReadCommand,
    SaveCommand, ScaleCommand, SetCommand, ShowCommand, TreeCommand, UngroupCommand,
  ]) client.register(cls);
  return client;
}
