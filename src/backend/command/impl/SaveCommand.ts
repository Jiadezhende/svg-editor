import PlaceholderCommand from '../PlaceholderCommand';

export default class SaveCommand extends PlaceholderCommand {
  static override readonly command = 'save';
  static override readonly usage = 'save [file.svg]';
}
