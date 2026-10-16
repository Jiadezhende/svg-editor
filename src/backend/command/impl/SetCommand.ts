import PlaceholderCommand from '../PlaceholderCommand';

export default class SetCommand extends PlaceholderCommand {
  static override readonly command = 'set';
  static override readonly usage = 'set <id> <attr> <value>';
}
