import { Marked } from 'marked';
import DOMPurify, { type Config } from 'dompurify';
import { t } from '../i18n';
import { MARKED_OPTIONS } from './markdown-tasks';

export { toggleMarkdownTask } from './markdown-tasks';

/*
 * Markdown is written by any member with the commenter role and shown to everyone on the board,
 * so it is rendered defensively:
 *  - raw HTML in the source is shown as text (no <style>, <form>, <img> or other tags);
 *  - external images are not loaded until the viewer clicks them (no tracking pixels);
 *  - the result is still passed through DOMPurify with a strict allowlist.
 */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function httpUrl(href: string): URL | null {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

const md = new Marked(MARKED_OPTIONS, {
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    image({ href, title, text }) {
      const url = httpUrl(href);
      if (!url) return escapeHtml(text);
      const label = text || url.pathname.split('/').pop() || url.host;
      const hint = t('Load the image from {host}', { host: url.host });
      return (
        `<button type="button" class="md-image" data-src="${escapeHtml(url.href)}" data-alt="${escapeHtml(text)}" title="${escapeHtml(title || hint)}">` +
        `<span class="md-image-label">${escapeHtml(label)}</span> <span class="md-image-host">${escapeHtml(url.host)}</span></button>`
      );
    },
  },
});

const PURIFY: Config = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'button', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'input',
    'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'class', 'type', 'checked', 'disabled', 'align', 'start', 'data-src', 'data-alt'],
  ALLOW_DATA_ATTR: false,
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  } else if (node.tagName === 'INPUT') {
    // Only task list checkboxes are rendered; they are enabled by MarkdownView when editable.
    node.setAttribute('type', 'checkbox');
    node.setAttribute('disabled', '');
  } else if (node.tagName === 'BUTTON') {
    node.setAttribute('type', 'button');
  }
});

export function renderMarkdown(src: unknown): string {
  const html = md.parse(typeof src === 'string' ? src : '', { async: false }) as string;
  return DOMPurify.sanitize(html, PURIFY) as string;
}
