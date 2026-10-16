import PlaceholderCommand from '../PlaceholderCommand';

export default class ScaleCommand extends PlaceholderCommand {
  static override readonly command = 'scale';
  static override readonly usage = 'scale <id> <factor>';
}
