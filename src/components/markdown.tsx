import { useEffect, useMemo, useRef, useState } from 'react';
import { cls } from '../lib/utils';
import { renderMarkdown } from '../lib/markdown';
import { Icon } from './Icons';
import { t } from '../i18n';

export { toggleMarkdownTask } from '../lib/markdown';

/*
 * Markdown rendering and editing. Kept apart from ui.tsx so that marked and DOMPurify load
 * together with the board, not on the sign-in page and the board list.
 */

export function MarkdownView({ source, className, onToggleTask }: { source: string; className?: string; onToggleTask?: (index: number) => void }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const boxes = el.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    boxes.forEach((b, i) => {
      b.disabled = !onToggleTask;
      b.onclick = onToggleTask
        ? (e) => {
            e.stopPropagation();
            onToggleTask(i);
          }
        : null;
    });
    // External images are placeholders until clicked (see lib/markdown.ts).
    el.querySelectorAll<HTMLButtonElement>('button.md-image').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const src = b.dataset.src ?? '';
        if (!/^https?:\/\//i.test(src)) return;
        const img = document.createElement('img');
        img.src = src;
        img.alt = b.dataset.alt ?? '';
        img.referrerPolicy = 'no-referrer';
        img.className = 'md-img';
        b.replaceWith(img);
      };
    });
  }, [html, onToggleTask]);
  return <div ref={ref} className={cls('markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minRows = 6,
  autoFocus,
  onKeyDown,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Keep in sync with the limits in firestore.rules. */
  maxLength?: number;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ta = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before, ph = '') => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || ph;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  };

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <div className="md-tabs">
          <button type="button" className={cls(tab === 'write' && 'is-active')} onClick={() => setTab('write')}>
            {t('Write')}
          </button>
          <button type="button" className={cls(tab === 'preview' && 'is-active')} onClick={() => setTab('preview')}>
            {t('Preview')}
          </button>
        </div>
        {tab === 'write' && (
          <div className="md-tools">
            <button type="button" title={t('Bold (Ctrl+B)')} onClick={() => wrap('**', '**', t('text'))}>
              <b>B</b>
            </button>
            <button type="button" title={t('Italic (Ctrl+I)')} onClick={() => wrap('_', '_', t('text'))}>
              <i>I</i>
            </button>
            <button type="button" title={t('Strikethrough')} onClick={() => wrap('~~', '~~', t('text'))}>
              <s>S</s>
            </button>
            <button type="button" title={t('Heading')} onClick={() => linePrefix('### ')}>
              H
            </button>
            <button type="button" title={t('Bulleted list')} onClick={() => linePrefix('- ')}>
              •
            </button>
            <button type="button" title={t('Checklist')} onClick={() => linePrefix('- [ ] ')}>
              ☑
            </button>
            <button type="button" title={t('Code')} onClick={() => wrap('`', '`', t('code'))}>
              {'</>'}
            </button>
            <button type="button" title={t('Insert link')} onClick={() => wrap('[', '](https://)', t('text'))}>
              <Icon name="link" size={14} />
            </button>
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ta}
          className="md-textarea"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t('Markdown supported: **bold**, _italic_, lists, - [ ] checklists, tables, `code`')}
          rows={Math.max(minRows, Math.min(24, value.split('\n').length + 1))}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              wrap('**', '**', t('text'));
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
              e.preventDefault();
              wrap('_', '_', t('text'));
            }
            onKeyDown?.(e);
          }}
        />
      ) : (
        <div className="md-preview">{value.trim() ? <MarkdownView source={value} /> : <span className="muted">{t('Nothing to preview')}</span>}</div>
      )}
    </div>
  );
}
