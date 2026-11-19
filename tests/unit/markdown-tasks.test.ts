import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Marked } from 'marked';
import { MARKED_OPTIONS, toggleMarkdownTask } from '../../src/lib/markdown-tasks.ts';

const md = new Marked(MARKED_OPTIONS);
const checkboxes = (src: string) => ((md.parse(src) as string).match(/type="checkbox"/g) ?? []).length;

test('toggles the only task', () => {
  assert.equal(toggleMarkdownTask('- [ ] a', 0), '- [x] a');
  assert.equal(toggleMarkdownTask('- [x] a', 0), '- [ ] a');
  assert.equal(toggleMarkdownTask('- [X] a', 0), '- [ ] a');
});

test('ignores task-like lines inside code blocks', () => {
  const src = '```\n- [ ] inside code\n```\n\n- [ ] real task';
  assert.equal(checkboxes(src), 1);
  assert.equal(toggleMarkdownTask(src, 0), '```\n- [ ] inside code\n```\n\n- [x] real task');
});

test('ignores indented code blocks and inline code', () => {
  const src = 'Text\n\n    - [ ] code\n\n- [ ] use `- [ ] x`\n- [ ] b';
  assert.equal(checkboxes(src), 2);
  assert.equal(toggleMarkdownTask(src, 1), 'Text\n\n    - [ ] code\n\n- [ ] use `- [ ] x`\n- [x] b');
});

test('handles tasks in blockquotes and nested lists', () => {
  const src = '> - [ ] quoted\n\n- [ ] outer\n  - [ ] inner\n1. [ ] numbered';
  assert.equal(checkboxes(src), 4);
  assert.equal(toggleMarkdownTask(src, 0), '> - [x] quoted\n\n- [ ] outer\n  - [ ] inner\n1. [ ] numbered');
  assert.equal(toggleMarkdownTask(src, 2), '> - [ ] quoted\n\n- [ ] outer\n  - [x] inner\n1. [ ] numbered');
  assert.equal(toggleMarkdownTask(src, 3), '> - [ ] quoted\n\n- [ ] outer\n  - [ ] inner\n1. [x] numbered');
});

test('identical items are toggled by position', () => {
  const src = '- [ ] same\n- [ ] same\n- [ ] same';
  assert.equal(toggleMarkdownTask(src, 1), '- [ ] same\n- [x] same\n- [ ] same');
});

test('empty "- [ ]" is not a task (marked renders no checkbox for it); CRLF input', () => {
  const src = '### Done when\r\n- [ ] \r\n- [ ] b\r\n';
  assert.equal(checkboxes(src), 1);
  assert.equal(toggleMarkdownTask(src, 0), '### Done when\n- [ ] \n- [x] b\n');
});

test('out of range leaves the text unchanged', () => {
  assert.equal(toggleMarkdownTask('- [ ] a', 5), '- [ ] a');
  assert.equal(toggleMarkdownTask('no tasks', 0), 'no tasks');
});
