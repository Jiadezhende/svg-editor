import PlaceholderCommand from '../PlaceholderCommand';

export default class DeleteCommand extends PlaceholderCommand {
  static override readonly command = 'delete';
  static override readonly usage = 'delete <id>';
}
