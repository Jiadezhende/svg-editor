import { describe, expect, it } from 'vitest';
import SvgSourceParser from '../src/outline/SvgSourceParser';

const parser = new SvgSourceParser();

describe('SvgSourceParser', () => {
  it('解析嵌套元素及其源码范围', () => {
    const text = [
      '<svg width="320" height="180">',
      '  <g id="flowchart">',
      '    <rect id="start" x="20" y="20" width="120" height="50" />',
      '    <text x="40" y="50">Start</text>',
      '  </g>',
      '</svg>',
    ].join('\n');
    const roots = parser.parse(text);
    expect(roots).toHaveLength(1);
    const svg = roots[0]!;
    expect(svg.name()).toBe('svg');
    expect(svg.children()).toHaveLength(1);

    const group = svg.children()[0]!;
    expect(group.name()).toBe('g#flowchart');
    expect(group.children().map((node) => node.name())).toEqual(['rect#start', 'text']);

    const rect = group.children()[0]!;
    expect(rect.start()).toBe(text.indexOf('<rect'));
    expect(rect.nameStart()).toBe(text.indexOf('rect', rect.start()));
    expect(rect.nameEnd()).toBe(rect.nameStart() + 'rect'.length);
    expect(rect.end()).toBe(text.indexOf('/>', rect.start()) + 2);
    expect(rect.start()).toBeLessThan(rect.end());

    const textNode = group.children()[1]!;
    expect(textNode.name()).toBe('text');
    expect(textNode.id()).toBeNull();
  });

  it('支持自闭合、注释、CDATA、DOCTYPE 和引号内的 >', () => {
    const text = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE svg [<!ENTITY note "a>b">]>',
      '<svg>',
      '  <!-- <fake id="ignored" /> -->',
      '  <g>',
      '    <![CDATA[<not-an-element>]]>',
      '    <rect id="r" data-text="a>b" />',
      '  </g>',
      '</svg>',
    ].join('\n');
    const roots = parser.parse(text);
    expect(roots).toHaveLength(1);
    const rect = roots[0]!.children()[0]!.children()[0]!;
    expect(rect.name()).toBe('rect#r');
    expect(rect.children()).toEqual([]);
  });

  it('解码 id 中的 XML 实体', () => {
    const roots = parser.parse('<svg><rect id="a&amp;b"/></svg>');
    expect(roots[0]!.children()[0]!.name()).toBe('rect#a&b');
  });

  it('文本更新后重新生成新的结构', () => {
    const before = parser.parse('<svg><rect id="a"/></svg>');
    const after = parser.parse('<svg><g id="b"><rect id="c"/></g></svg>');
    expect(before[0]!.children()[0]!.name()).toBe('rect#a');
    expect(after[0]!.children()[0]!.name()).toBe('g#b');
    expect(after[0]!.children()[0]!.children()[0]!.name()).toBe('rect#c');
  });

  it('不完整或结构错误时返回空数组', () => {
    expect(parser.parse('')).toEqual([]);
    expect(parser.parse('<svg><g><rect id="r"/>')).toEqual([]);
    expect(parser.parse('<svg><g></svg>')).toEqual([]);
    expect(parser.parse('<svg><!-- unfinished')).toEqual([]);
    expect(parser.parse('<svg><rect id="r"')).toEqual([]);
  });
});
