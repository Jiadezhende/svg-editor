import PlaceholderCommand from '../PlaceholderCommand';

export default class ReadCommand extends PlaceholderCommand {
  static override readonly command = 'read';
  static override readonly usage = 'read <file.svg>';
}
