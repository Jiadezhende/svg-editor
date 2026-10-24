import { describe, expect, it } from 'vitest';
import DecimalFormat from '../../../../../src/backend/receiver/document/attribute/DecimalFormat';

// 规则的完整用例经 Command 的 parseNumber / formatNumber 覆盖（Command.test），这里只验证直接调用。
describe('DecimalFormat', () => {
  const decimal = new DecimalFormat();

  it('解析十进制数字，拒绝其他写法', () => {
    expect(decimal.parse('-0.5')).toBe(-0.5);
    expect(() => decimal.parse('1e3')).toThrow('not a number: 1e3');
  });

  it('按数值格式输出', () => {
    expect(decimal.format(0.1 + 0.2)).toBe('0.3');
    expect(decimal.format(-0)).toBe('0');
  });

  it('tryParse：不符合规则时返回 null 而不报错', () => {
    expect(decimal.tryParse('12.5')).toBe(12.5);
    expect(decimal.tryParse('100%')).toBeNull();
    expect(decimal.tryParse('10px')).toBeNull();
  });
});
