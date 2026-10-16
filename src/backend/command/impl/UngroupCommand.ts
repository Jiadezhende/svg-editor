import PlaceholderCommand from '../PlaceholderCommand';

export default class UngroupCommand extends PlaceholderCommand {
  static override readonly command = 'ungroup';
  static override readonly usage = 'ungroup <gid>';
}
