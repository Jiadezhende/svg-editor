import { describe, expect, it } from 'vitest';
import TextAttribute from '../../../../../../src/backend/receiver/document/shape/attribute/TextAttribute';

describe('TextAttribute 文本内容', () => {
  const attribute = new TextAttribute('text', 'hello');

  it('展示时加双引号，原值不带引号', () => {
    expect(attribute.display()).toBe('"hello"');
    expect(attribute.value).toBe('hello');
  });

  it('重新构造仍保留引用展示规则', () => {
    expect(attribute.withValue('next').display()).toBe('"next"');
    expect(attribute.withToken('a "b"').display()).toBe('"a "b""');
  });
});
