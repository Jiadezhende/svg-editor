import PlaceholderCommand from '../PlaceholderCommand';

export default class InitCommand extends PlaceholderCommand {
  static override readonly command = 'init';
  static override readonly usage = 'init [w] [h]';
}
