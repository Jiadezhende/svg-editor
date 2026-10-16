import PlaceholderCommand from '../PlaceholderCommand';

export default class BackCommand extends PlaceholderCommand {
  static override readonly command = 'back';
  static override readonly usage = 'back <id>';
}
