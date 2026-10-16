import PlaceholderCommand from '../PlaceholderCommand';

export default class TreeCommand extends PlaceholderCommand {
  static override readonly command = 'tree';
  static override readonly usage = 'tree [id]';
}
