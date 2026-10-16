import PlaceholderCommand from '../PlaceholderCommand';

export default class ShowCommand extends PlaceholderCommand {
  static override readonly command = 'show';
  static override readonly usage = 'show <id>';
}
