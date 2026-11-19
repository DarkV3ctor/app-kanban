import { Lexer, type Token, type Tokens } from 'marked';

/*
 * Toggling `- [ ]` task items from the rendered checkboxes.
 *
 * The N-th checkbox in the rendered HTML is the N-th task list item in marked's token tree
 * (depth-first). To find that item in the source, the top-level tokens are walked with their
 * offsets (their raw texts add up to the source), so text inside code blocks, quotes or other
 * blocks is never mistaken for a task.
 *
 * This module only depends on marked, so it can be unit-tested in Node.
 */

export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

const TASK_MARK = /^([ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[[ xX]\]/;

function collectTasks(tok: Token, out: Tokens.ListItem[]) {
  if (tok.type === 'list') {
    for (const item of (tok as Tokens.List).items) {
      if (item.task) out.push(item);
      for (const child of item.tokens) collectTasks(child, out);
    }
    return;
  }
  const children = (tok as { tokens?: Token[] }).tokens;
  if (Array.isArray(children)) for (const child of children) collectTasks(child, out);
}

/** Returns `src` with the `index`-th task checkbox flipped, or `src` unchanged if it cannot be located. */
export function toggleMarkdownTask(src: string, index: number): string {
  const text = src.replace(/\r\n?/g, '\n');
  const tokens = Lexer.lex(text, MARKED_OPTIONS);
  // If the raw texts do not add up to the source, fall back to treating it as one block.
  const blocks = tokens.map((t) => t.raw).join('') === text ? tokens : null;
  const ranges = blocks
    ? (() => {
        let offset = 0;
        return blocks.map((tok) => {
          const start = offset;
          offset += tok.raw.length;
          return { tok: [tok], start, end: offset };
        });
      })()
    : [{ tok: tokens as Token[], start: 0, end: text.length }];

  let n = 0;
  for (const range of ranges) {
    const tasks: Tokens.ListItem[] = [];
    for (const tok of range.tok) collectTasks(tok, tasks);
    if (index >= n + tasks.length) {
      n += tasks.length;
      continue;
    }
    let cursor = range.start;
    for (const item of tasks) {
      const firstLine = item.raw.split('\n')[0];
      const m = TASK_MARK.exec(firstLine);
      if (!m) return src;
      // Nested items are re-indented and quoted ones lose their "> ", so search without the indent.
      const needle = firstLine.trimStart();
      const at = text.indexOf(needle, cursor);
      if (at < 0 || at >= range.end) return src;
      if (n === index) {
        const open = at + m[1].length - (firstLine.length - needle.length);
        if (text[open] !== '[' || text[open + 2] !== ']') return src;
        return text.slice(0, open + 1) + (text[open + 1] === ' ' ? 'x' : ' ') + text.slice(open + 2);
      }
      n++;
      cursor = at + needle.length;
    }
    return src;
  }
  return src;
}
