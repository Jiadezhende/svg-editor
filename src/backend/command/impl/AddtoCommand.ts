import PlaceholderCommand from '../PlaceholderCommand';

export default class AddtoCommand extends PlaceholderCommand {
  static override readonly command = 'addto';
  static override readonly usage = 'addto <gid> <id>';
}
