import PlaceholderCommand from '../PlaceholderCommand';

export default class CreateCommand extends PlaceholderCommand {
  static override readonly command = 'create';
  static override readonly usage = 'create <type> <id> [params…] [in <containerId>]';
}
