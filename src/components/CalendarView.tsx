import { memo, useMemo, useRef, useState } from 'react';
import type { Board, Issue } from '../types';
import { useApp } from '../app-context';
import { lang, locale, t, tk } from '../i18n';
import { applyFilters } from '../lib/issues';
import { fieldName, hasField } from '../lib/fields';
import { cls, isDone, monthName, toISODate, todayISO } from '../lib/utils';
import { useBoard } from './board-context';
import { FilterBar } from './FilterBar';
import { Icon, TypeIcon } from './Icons';
import { StatusBadge } from './IssueFields';
import { CoverImage } from './Cover';

/*
 * The board's calendar: what comes out (media boards: the release date) or is due (other boards)
 * on which day. A month grid, or a list of the month's days that have something (the default on
 * phones). The board's filters apply.
 */

type Mode = 'month' | 'list';
const MODES: { id: Mode; name: string; icon: string }[] = [
  { id: 'month', name: tk('Month'), icon: 'calendar' },
  { id: 'list', name: tk('List'), icon: 'list' },
];
const MODE_KEY = 'kb-calendar-mode';
const monthKey = (boardId: string) => 'kb-calendar-month-' + boardId;

/** Weeks start on Monday in Ukrainian, on Sunday in (US) English. */
const WEEK_START = lang === 'uk' ? 1 : 0;
const fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
const fmtDay = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
// 7 January 2024 was a Sunday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => fmtWeekday.format(new Date(2024, 0, 7 + ((WEEK_START + i) % 7))));

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** The date the calendar of a board is about: the release date where the board has one, else the due date. */
export function calendarField(board: Pick<Board, 'template'>): 'releaseDate' | 'dueDate' {
  return hasField(board, 'releaseDate') ? 'releaseDate' : 'dueDate';
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'month' || v === 'list') return v;
  } catch {
    /* ignore */
  }
  return matchMedia('(max-width: 760px)').matches ? 'list' : 'month';
}

function readMonth(boardId: string): string {
  try {
    const v = sessionStorage.getItem(monthKey(boardId));
    if (isMonth(v)) return v;
  } catch {
    /* ignore */
  }
  return todayISO().slice(0, 7);
}

/** 'YYYY-MM' moved by a number of months. */
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  return toISODate(new Date(y, m - 1 + by, 1)).slice(0, 7);
}

const dateOf = (iso: string) => new Date(iso + 'T00:00:00');

/** Whether the browser has a month picker it can open from a button (not Firefox and older Safari). */
const CAN_PICK_MONTH = (() => {
  const input = document.createElement('input');
  input.type = 'month';
  return input.type === 'month' && typeof input.showPicker === 'function';
})();

// Memoized: re-renders only when the board context changes, not on every BoardPage render.
export const CalendarView = memo(function CalendarView() {
  const { user } = useApp();
  const { board, issues, filters, openIssue, newIssue, perms } = useBoard();
  const field = calendarField(board);
  const [month, setMonthState] = useState(() => readMonth(board.id));
  const [mode, setModeState] = useState<Mode>(readMode);
  const pickerRef = useRef<HTMLInputElement>(null);
  // showPicker() throws where the browser will not open one (a cross-origin frame, for example).
  const openPicker = () => {
    try {
      pickerRef.current?.showPicker();
    } catch {
      /* the arrows still work */
    }
  };

  const setMonth = (m: string) => {
    setMonthState(m);
    try {
      sessionStorage.setItem(monthKey(board.id), m);
    } catch {
      /* ignore */
    }
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const shown = useMemo(() => applyFilters(board, issues, filters, user), [board, issues, filters, user]);
  const byDay = useMemo(() => {
    const typeIdx = new Map(board.issueTypes.map((x, i) => [x.id, i]));
    const map = new Map<string, Issue[]>();
    for (const i of shown) {
      const day = i[field];
      if (!day) continue;
      const list = map.get(day);
      if (list) list.push(i);
      else map.set(day, [i]);
    }
    for (const list of map.values()) list.sort((a, b) => (typeIdx.get(a.type) ?? 99) - (typeIdx.get(b.type) ?? 99) || a.title.localeCompare(b.title));
    return map;
  }, [shown, field, board.issueTypes]);
  const undated = shown.filter((i) => !i[field]).length;

  const today = todayISO();
  const [year, mon] = month.split('-').map(Number);
  const first = new Date(year, mon - 1, 1);
  const offset = (first.getDay() - WEEK_START + 7) % 7;
  const daysInMonth = new Date(year, mon, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => toISODate(new Date(year, mon - 1, 1 - offset + i)));
  const monthDays = cells.filter((d) => d.startsWith(month) && byDay.has(d));
  const create = (day: string) => newIssue(field === 'releaseDate' ? { releaseDate: day } : { dueDate: day });

  return (
    <div className="calendar-view">
      <div className="view-head">
        <h1>{t('Calendar')}</h1>
        <div className="seg" role="radiogroup" aria-label={t('View')}>
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={cls(mode === m.id && 'is-active')} onClick={() => setMode(m.id)}>
              <Icon name={m.icon} size={14} />
              {t(m.name)}
            </button>
          ))}
        </div>
      </div>
      <FilterBar showHideDone />
      <div className="cal-toolbar">
        <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('Previous month')} title={t('Previous month')}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('Next month')} title={t('Next month')}>
          <Icon name="chevronRight" size={18} />
        </button>
        <h2 className="cal-title" aria-live="polite">
          {monthName(first)} {year}
        </h2>
        <button type="button" className="btn btn-subtle btn-sm" onClick={() => setMonth(today.slice(0, 7))} disabled={month === today.slice(0, 7)}>
          {t('Today')}
        </button>
        {CAN_PICK_MONTH && (
          // The browser's own month picker, opened from a button (the field itself stays out of sight).
          <span className="cal-pick">
            <button type="button" className="icon-btn" onClick={openPicker} aria-label={t('Go to month')} title={t('Go to month')}>
              <Icon name="calendar" size={18} />
            </button>
            <input ref={pickerRef} type="month" tabIndex={-1} aria-hidden="true" value={month} onChange={(e) => isMonth(e.target.value) && setMonth(e.target.value)} />
          </span>
        )}
        <span className="cal-field muted small">
          {fieldName(board, field)}
          {undated > 0 && ` · ${t('not set for {n}', { n: undated })}`}
        </span>
      </div>

      {mode === 'month' ? (
        <div className="cal-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday" aria-hidden="true">
              {w}
            </div>
          ))}
          {cells.map((day) => {
            const d = dateOf(day);
            const items = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                role="group"
                aria-label={capitalize(fmtDay.format(d))}
                className={cls('cal-day', !day.startsWith(month) && 'is-outside', day === today && 'is-today', (d.getDay() === 0 || d.getDay() === 6) && 'is-weekend')}
              >
                <div className="cal-day-head">
                  <span className="cal-day-num">{d.getDate()}</span>
                  {perms.edit && (
                    <button type="button" className="cal-add" onClick={() => create(day)} aria-label={t('Create an issue for {date}', { date: fmtDay.format(d) })} title={t('Create an issue for {date}', { date: fmtDay.format(d) })}>
                      <Icon name="plus" size={14} />
                    </button>
                  )}
                </div>
                {items.map((i) => (
                  <CalendarItem key={i.id} board={board} issue={i} onOpen={openIssue} />
                ))}
              </div>
            );
          })}
        </div>
      ) : monthDays.length === 0 ? (
        <div className="cal-empty muted">{field === 'releaseDate' ? t('Nothing comes out this month.') : t('Nothing is due this month.')}</div>
      ) : (
        <div className="cal-list">
          {monthDays.map((day) => (
            <section key={day} className={cls('cal-list-day', day === today && 'is-today')}>
              <h3 className="cal-list-date">
                {capitalize(fmtDay.format(dateOf(day)))}
                {day === today && <span className="cal-today-tag">{t('Today')}</span>}
              </h3>
              {byDay.get(day)!.map((i) => (
                <CalendarRow key={i.id} board={board} issue={i} onOpen={openIssue} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
});

function Thumb({ board, issue, size }: { board: Board; issue: Issue; size: number }) {
  const type = board.issueTypes.find((x) => x.id === issue.type);
  if (issue.cover && hasField(board, 'cover')) return <CoverImage src={issue.cover} className="cover-thumb" fallback={<TypeIcon type={type} size={size} />} />;
  return <TypeIcon type={type} size={size} />;
}

/** One issue in a day of the month grid. */
function CalendarItem({ board, issue, onOpen }: { board: Board; issue: Issue; onOpen: (i: Issue) => void }) {
  const type = board.issueTypes.find((x) => x.id === issue.type);
  return (
    <button
      type="button"
      className={cls('cal-item', isDone(board, issue) && 'is-done', issue.cover && hasField(board, 'cover') && 'has-cover')}
      style={{ ['--type' as string]: type?.color ?? 'var(--border-strong)' }}
      onClick={() => onOpen(issue)}
      title={`${board.key}-${issue.number} ${issue.title}`}
    >
      <Thumb board={board} issue={issue} size={14} />
      <span className="cal-item-title">{issue.title}</span>
    </button>
  );
}

/** One issue in the list of the month's days. */
function CalendarRow({ board, issue, onOpen }: { board: Board; issue: Issue; onOpen: (i: Issue) => void }) {
  const type = board.issueTypes.find((x) => x.id === issue.type);
  return (
    <button type="button" className={cls('cal-row', isDone(board, issue) && 'is-done')} onClick={() => onOpen(issue)}>
      <Thumb board={board} issue={issue} size={20} />
      <span className="cal-row-text">
        <span className="cal-row-title">{issue.title}</span>
        <span className="muted small">
          {board.key}-{issue.number}
          {type && ` · ${type.name}`}
        </span>
      </span>
      <StatusBadge board={board} status={issue.status} />
    </button>
  );
}
