import type { ExtensionPlugin } from '../../src/backend';
import Rect from './Rect';
import Circle from './Circle';
import Ellipse from './Ellipse';
import Line from './Line';
import Text from './Text';
import Group from './Group';

export default {
  activate(context) {
    context.registerShape(Rect);
    context.registerShape(Circle);
    context.registerShape(Ellipse);
    context.registerShape(Line);
    context.registerShape(Text);
    context.registerShape(Group);
  },
} satisfies ExtensionPlugin;
