import PlaceholderCommand from '../PlaceholderCommand';

export default class GroupCommand extends PlaceholderCommand {
  static override readonly command = 'group';
  static override readonly usage = 'group <newGid> <id1> <id2>…';
}
