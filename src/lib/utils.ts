import type { Board, Column, Issue, Priority, Role } from '../types';

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
  { id: 'highest', name: 'Наивысший', color: '#C9372C' },
  { id: 'high', name: 'Высокий', color: '#E2483D' },
  { id: 'medium', name: 'Средний', color: '#E2B203' },
  { id: 'low', name: 'Низкий', color: '#1D7AFC' },
  { id: 'lowest', name: 'Самый низкий', color: '#579DFF' },
];

export const PRIORITY_ORDER: Record<Priority, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };

export function priorityName(p: Priority): string {
  return PRIORITIES.find((x) => x.id === p)?.name ?? p;
}

export const ROLES: { id: Role; name: string; rank: number; description: string }[] = [
  { id: 'owner', name: 'Владелец', rank: 5, description: 'Полный доступ, удаление доски, передача владения' },
  { id: 'admin', name: 'Администратор', rank: 4, description: 'Настройки доски, колонки, версии, участники и права' },
  { id: 'editor', name: 'Редактор', rank: 3, description: 'Создание, редактирование и перемещение задач' },
  { id: 'commenter', name: 'Комментатор', rank: 2, description: 'Просмотр и комментарии' },
  { id: 'viewer', name: 'Наблюдатель', rank: 1, description: 'Только просмотр' },
];

export function roleName(r: Role | undefined | null): string {
  return ROLES.find((x) => x.id === r)?.name ?? '—';
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

/** Ранг для вставки между соседями (для сортировки карточек). */
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

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
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

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '';
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(toISODate(d))}, ${time}`;
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} дн назад`;
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

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function sanitizeKey(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function suggestKey(name: string): string {
  const translit: Record<string, string> = {
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'ZH', З: 'Z', И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O',
    П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'CH', Ш: 'SH', Щ: 'SCH', Ы: 'Y', Э: 'E', Ю: 'YU', Я: 'YA',
    І: 'I', Ї: 'I', Є: 'E', Ґ: 'G',
  };
  const up = name.toUpperCase();
  let out = '';
  for (const ch of up) out += translit[ch] ?? ch;
  const words = out.split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return 'PRJ';
  if (words.length === 1) return words[0].slice(0, 5);
  return words.map((w) => w[0]).join('').slice(0, 5);
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
