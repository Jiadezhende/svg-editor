import ParseError from './ParseError';

/**
 * 分词器：按空白分隔参数；双引号内的内容（含空白）属于同一个参数，引号本身不计入值。
 * 引号未闭合时报错。
 */
export default class Tokenizer {
  tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inToken = false;
    let quoted = false;

    for (const ch of line) {
      if (ch === '"') {
        quoted = !quoted;
        inToken = true;
      } else if (!quoted && /\s/.test(ch)) {
        if (inToken) {
          tokens.push(current);
          current = '';
          inToken = false;
        }
      } else {
        current += ch;
        inToken = true;
      }
    }

    if (quoted) {
      throw new ParseError('unclosed quote');
    }
    if (inToken) {
      tokens.push(current);
    }
    return tokens;
  }
}
