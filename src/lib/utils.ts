import type { Board, Column, Issue, Priority, Role } from '../types';
import { locale, t, tk } from '../i18n';

export function uid(len = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += chars[b % chars.length];
  return s;
}

export function issueKey(board: Pick<Board, 'key'>, issue: Pick<Issue, 'number'>): string {
  return `${board.key}-${issue.number}`;
}

export const PRIORITIES: { id: Priority; name: string; color: string }[] = [
  { id: 'highest', name: tk('Highest'), color: '#C9372C' },
  { id: 'high', name: tk('High'), color: '#E2483D' },
  { id: 'medium', name: tk('Medium'), color: '#E2B203' },
  { id: 'low', name: tk('Low'), color: '#1D7AFC' },
  { id: 'lowest', name: tk('Lowest'), color: '#579DFF' },
];

export const PRIORITY_ORDER: Record<Priority, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };

export function priorityName(p: Priority | string): string {
  const found = PRIORITIES.find((x) => x.id === p);
  return found ? t(found.name) : p;
}

export const ROLES: { id: Role; name: string; rank: number; description: string }[] = [
  { id: 'owner', name: tk('Owner'), rank: 5, description: tk('Full access, can delete the board and transfer ownership') },
  { id: 'admin', name: tk('Admin'), rank: 4, description: tk('Board settings, columns, versions, members and permissions') },
  { id: 'editor', name: tk('Editor'), rank: 3, description: tk('Create, edit and move issues') },
  { id: 'commenter', name: tk('Commenter'), rank: 2, description: tk('View and comment') },
  { id: 'viewer', name: tk('Viewer'), rank: 1, description: tk('View only') },
];

export function roleName(r: Role | undefined | null): string {
  const found = ROLES.find((x) => x.id === r);
  return found ? t(found.name) : '—';
}

export function roleRank(board: Board | null | undefined, ghId: string | undefined): number {
  if (!board || !ghId) return 0;
  if (board.ownerId === ghId) return 5;
  const r = board.members[ghId];
  if (!r || r === 'owner') return 0;
  return ROLES.find((x) => x.id === r)?.rank ?? 0;
}

export interface Perms {
  rank: number;
  view: boolean;
  comment: boolean;
  edit: boolean;
  admin: boolean;
  owner: boolean;
}

export function permsFor(board: Board | null | undefined, ghId: string | undefined): Perms {
  const rank = roleRank(board, ghId);
  return { rank, view: rank >= 1, comment: rank >= 2, edit: rank >= 3, admin: rank >= 4, owner: rank >= 5 };
}

/** Rank value that sorts between two neighbours (used for card ordering). */
export function rankBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return (after as number) - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}

export function columnCategory(board: Board, statusId: string): Column['category'] {
  return board.columns.find((c) => c.id === statusId)?.category ?? 'todo';
}

export function isDone(board: Board, issue: Issue): boolean {
  return columnCategory(board, issue.status) === 'done';
}

const LABEL_COLORS = ['#1D7AFC', '#22A06B', '#E2B203', '#E56910', '#C9372C', '#AE4787', '#6E5DC6', '#1D9AAA', '#8590A2', '#5B7F24'];

export function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return LABEL_COLORS[Math.abs(h) % LABEL_COLORS.length];
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const fmtShort = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
const fmtShortYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'long' });
const fmtRelative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

/** Short date like "19 Nov" in the UI locale; the year is added only when it differs from the current one. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return (d.getFullYear() === new Date().getFullYear() ? fmtShort : fmtShortYear).format(d);
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${formatDate(toISODate(d))}, ${fmtTime.format(d)}`;
}

/** Capitalized standalone month name in the UI locale, e.g. "November". */
export function monthName(d: Date): string {
  const s = fmtMonth.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeAgo(ms: number): string {
  const diffSec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return t('just now');
  if (abs < 3600) return fmtRelative.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return fmtRelative.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 7 * 86400) return fmtRelative.format(Math.round(diffSec / 86400), 'day');
  return formatDateTime(ms);
}

export type DueState = 'overdue' | 'soon' | 'ok' | null;

export function dueState(iso: string | null, done: boolean): DueState {
  if (!iso || done) return null;
  const today = todayISO();
  if (iso < today) return 'overdue';
  if (iso <= addDays(today, 2)) return 'soon';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function sanitizeKey(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

/** Suggest a project key from its name (Cyrillic names are transliterated). */
export function suggestKey(name: string): string {
  const translit: Record<string, string> = {
    А: 'A', Б: 'B', В: 'V', Г: 'H', Ґ: 'G', Д: 'D', Е: 'E', Є: 'YE', Ё: 'E', Ж: 'ZH', З: 'Z', И: 'Y', І: 'I', Ї: 'YI', Й: 'Y', К: 'K',
    Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SHCH',
    Ы: 'Y', Э: 'E', Ю: 'YU', Я: 'YA',
  };
  let out = '';
  for (const ch of name.toUpperCase()) out += translit[ch] ?? ch;
  const words = out.split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return 'PRJ';
  if (words.length === 1) return words[0].slice(0, 5);
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 5);
}

export function downloadFile(filename: string, content: BlobPart, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}
