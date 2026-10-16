import PlaceholderCommand from '../PlaceholderCommand';

export default class FrontCommand extends PlaceholderCommand {
  static override readonly command = 'front';
  static override readonly usage = 'front <id>';
}
