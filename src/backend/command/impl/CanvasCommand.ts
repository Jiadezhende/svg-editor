import PlaceholderCommand from '../PlaceholderCommand';

export default class CanvasCommand extends PlaceholderCommand {
  static override readonly command = 'canvas';
  static override readonly usage = 'canvas [<w> <h>]';
}
