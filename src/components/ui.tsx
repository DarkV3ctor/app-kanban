import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Board, ColumnCategory, MemberInfo } from '../types';
import { cls, hashColor } from '../lib/utils';
import { renderMarkdown } from '../lib/markdown';
import { Icon } from './Icons';
import { t } from '../i18n';

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({ info, size = 24, title }: { info?: Partial<MemberInfo> | null; size?: number; title?: string }) {
  const [broken, setBroken] = useState(false);
  const label = title ?? (info ? `${info.name || info.login}${info.login && info.name !== info.login ? ` (@${info.login})` : ''}` : t('Unassigned'));
  if (!info) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }} title={label}>
        <Icon name="user" size={size * 0.62} />
      </span>
    );
  }
  if (info.avatarUrl && !broken) {
    return <img className="avatar" src={info.avatarUrl} width={size} height={size} alt="" title={label} onError={() => setBroken(true)} loading="lazy" />;
  }
  const letter = (info.name || info.login || '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <span className="avatar avatar-letter" style={{ width: size, height: size, background: hashColor(info.login || info.name || ''), fontSize: size * 0.45 }} title={label}>
      {letter}
    </span>
  );
}

export function memberOf(board: Board, id: string | null | undefined): MemberInfo | null {
  if (!id) return null;
  return board.memberInfo[id] ?? { login: id, name: id, avatarUrl: '' };
}

// ---------------------------------------------------------------------------
// Lozenges
// ---------------------------------------------------------------------------

export function StatusLozenge({ category, children }: { category: ColumnCategory; children: ReactNode }) {
  return <span className={`lozenge lozenge-${category}`}>{children}</span>;
}

export function LabelChip({ text, onRemove }: { text: string; onRemove?: () => void }) {
  return (
    <span className="chip" style={{ ['--chip' as string]: hashColor(text) }}>
      {text}
      {onRemove && (
        <button className="chip-x" onClick={onRemove} aria-label={t('Remove {name}', { name: text })}>
          <Icon name="close" size={10} />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  className,
  headerExtra,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  headerExtra?: ReactNode;
}) {
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.popover')) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onMouseUp={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div className={cls('modal', `modal-${size}`, className)} role="dialog" aria-modal="true">
        {(title || headerExtra) && (
          <div className="modal-head">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            <div className="modal-head-actions">
              {headerExtra}
              <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Popover (positioned relative to an anchor, rendered into body)
// ---------------------------------------------------------------------------

export function Popover({
  anchor,
  onClose,
  children,
  width,
  align = 'start',
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'end';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const el = ref.current;
      const w = el?.offsetWidth ?? width ?? 240;
      const h = el?.offsetHeight ?? 200;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      let top = r.bottom + 4;
      let maxH = Math.max(160, spaceBelow);
      if (h > spaceBelow && spaceAbove > spaceBelow) {
        maxH = Math.max(160, spaceAbove);
        top = Math.max(8, r.top - 4 - Math.min(h, maxH));
      }
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
      setPos({ top, left, maxH });
    };
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, width, align]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className="popover"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, maxHeight: pos?.maxH, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Select menu (single and multi select, search, create)
// ---------------------------------------------------------------------------

export interface Option {
  value: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

interface SelectProps {
  options: Option[];
  value: string | null | string[];
  onChange: (v: string | null | string[]) => void;
  multi?: boolean;
  placeholder?: string;
  searchable?: boolean;
  allowCreate?: boolean;
  createLabel?: (q: string) => string;
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  renderValue?: (selected: Option[]) => ReactNode;
  className?: string;
  width?: number;
  triggerClass?: string;
  ariaLabel?: string;
}

export function Select({
  options,
  value,
  onChange,
  multi,
  placeholder = t('Select…'),
  searchable,
  allowCreate,
  createLabel = (q) => t('Create "{name}"', { name: q }),
  clearable,
  clearLabel = t('None'),
  disabled,
  renderValue,
  className,
  width,
  triggerClass,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const selectedValues = useMemo(() => (Array.isArray(value) ? value : value ? [value] : []), [value]);
  const selected = selectedValues.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });
  const showSearch = searchable ?? (options.length > 7 || allowCreate);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const canCreate = allowCreate && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  const items: (Option & { create?: boolean; clear?: boolean })[] = [
    ...(clearable && !multi ? [{ value: '__clear', label: clearLabel, clear: true }] : []),
    ...filtered,
    ...(canCreate ? [{ value: q.trim(), label: createLabel(q.trim()), create: true }] : []),
  ];

  const pick = (o: Option & { clear?: boolean }) => {
    if (o.clear) {
      onChange(null);
      setOpen(false);
      return;
    }
    if (multi) {
      const set = new Set(selectedValues);
      if (set.has(o.value)) set.delete(o.value);
      else set.add(o.value);
      onChange([...set]);
      setQ('');
    } else {
      onChange(o.value);
      setOpen(false);
    }
  };

  const close = () => {
    setOpen(false);
    setQ('');
    setActive(0);
  };

  return (
    <div className={cls('select', className)}>
      <button
        ref={btn}
        type="button"
        className={cls('select-trigger', triggerClass, open && 'is-open')}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {renderValue ? (
          renderValue(selected)
        ) : selected.length ? (
          <span className="select-value">
            {selected.map((o) => (
              <span key={o.value} className="select-value-item">
                {o.icon}
                <span>{o.label}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="select-placeholder">{placeholder}</span>
        )}
        {!disabled && <Icon name="chevronDown" size={14} className="select-caret" />}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={close} width={width ?? Math.max(220, btn.current?.offsetWidth ?? 0)}>
          {showSearch && (
            <div className="popover-search">
              <input
                autoFocus
                value={q}
                placeholder={allowCreate ? t('Find or create…') : t('Search…')}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(items.length - 1, a + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (items[active]) pick(items[active]);
                  }
                }}
              />
            </div>
          )}
          <div className="menu" role="listbox" aria-multiselectable={multi}>
            {items.length === 0 && <div className="menu-empty">{t('Nothing found')}</div>}
            {items.map((o, i) => {
              const isSel = !o.create && !o.clear && selectedValues.includes(o.value);
              return (
                <button
                  key={(o.create ? 'create:' : '') + o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={cls('menu-item', isSel && 'is-selected', i === active && showSearch && 'is-active', o.clear && 'menu-item-muted')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  {multi && !o.create && <span className={cls('checkbox', isSel && 'is-checked')}>{isSel && <Icon name="check" size={11} />}</span>}
                  {o.create && <Icon name="plus" size={14} />}
                  {o.icon}
                  <span className="menu-label">{o.label}</span>
                  {o.hint && <span className="menu-hint">{o.hint}</span>}
                  {!multi && isSel && <Icon name="check" size={14} className="menu-check" />}
                </button>
              );
            })}
          </div>
        </Popover>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action menu
// ---------------------------------------------------------------------------

export interface MenuAction {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export function ActionMenu({ actions, label = t('Actions'), icon = 'more', align = 'end', buttonClass = 'icon-btn' }: { actions: MenuAction[]; label?: string; icon?: string; align?: 'start' | 'end'; buttonClass?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;
  return (
    <>
      <button ref={btn} className={buttonClass} onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))} aria-label={label} title={label}>
        <Icon name={icon} size={18} />
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} width={220} align={align}>
          <div className="menu">
            {visible.map((a) => (
              <button
                key={a.label}
                className={cls('menu-item', a.danger && 'menu-item-danger')}
                disabled={a.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  a.onClick();
                }}
              >
                {a.icon && <Icon name={a.icon} size={16} />}
                <span className="menu-label">{a.label}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

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
  }, [html, onToggleTask]);
  return <div ref={ref} className={cls('markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Toggles the N-th `- [ ]` checkbox in markdown text. */
export function toggleMarkdownTask(src: string, index: number): string {
  let n = -1;
  return src.replace(/^(\s*(?:[-*+]|\d+\.)\s+)\[( |x|X)\]/gm, (m, pre: string, mark: string) => {
    n++;
    if (n !== index) return m;
    return `${pre}[${mark === ' ' ? 'x' : ' '}]`;
  });
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minRows = 6,
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
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

// ---------------------------------------------------------------------------
// Inline text editing
// ---------------------------------------------------------------------------

export function InlineText({
  value,
  onSave,
  disabled,
  className,
  placeholder,
  multiline,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => {
    if (!edit) setV(value);
  }, [value, edit]);
  if (!edit || disabled) {
    return (
      <div
        className={cls('inline-text', !disabled && 'is-editable', className, !value && 'is-empty')}
        onClick={() => !disabled && setEdit(true)}
        tabIndex={disabled ? undefined : 0}
        onKeyDown={(e) => !disabled && e.key === 'Enter' && setEdit(true)}
        role={disabled ? undefined : 'button'}
      >
        {value || placeholder}
      </div>
    );
  }
  const commit = () => {
    setEdit(false);
    const t = v.trim();
    if (t && t !== value) onSave(t);
  };
  const props = {
    autoFocus: true,
    value: v,
    className: cls('inline-input', className),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.shiftKey && multiline)) {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setV(value);
        setEdit(false);
      }
    },
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <div className="muted">{label}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'board', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={36} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ProgressBar({ done, progress, total }: { done: number; progress: number; total: number }) {
  if (!total) return <div className="progress"><div className="progress-empty" /></div>;
  const pd = (done / total) * 100;
  const pp = (progress / total) * 100;
  return (
    <div className="progress" title={t('Done: {done}, in progress: {progress}, to do: {todo}', { done, progress, todo: total - done - progress })}>
      <div className="progress-done" style={{ width: `${pd}%` }} />
      <div className="progress-progress" style={{ width: `${pp}%` }} />
    </div>
  );
}
