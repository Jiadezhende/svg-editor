import PlaceholderCommand from '../PlaceholderCommand';

export default class MoveCommand extends PlaceholderCommand {
  static override readonly command = 'move';
  static override readonly usage = 'move <id> <dx> <dy>';
}
