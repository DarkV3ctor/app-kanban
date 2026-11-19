import type { AppUser, Board, BoardSetup, HistoryChange, Issue, IssueDraft, LinkType, Priority } from '../types';
import type { SampleIssue } from '../templates';
import { PRIORITY_ORDER, addDays, columnCategory, priorityName, todayISO, uid } from './utils';

export const LINK_TYPES: { id: LinkType; name: string; inverse: LinkType }[] = [
  { id: 'blocks', name: 'блокирует', inverse: 'blocked_by' },
  { id: 'blocked_by', name: 'заблокирована', inverse: 'blocks' },
  { id: 'relates', name: 'связана с', inverse: 'relates' },
  { id: 'duplicates', name: 'дублирует', inverse: 'duplicated_by' },
  { id: 'duplicated_by', name: 'дублируется', inverse: 'duplicates' },
];

export function linkName(t: LinkType): string {
  return LINK_TYPES.find((l) => l.id === t)?.name ?? t;
}

export function inverseLink(t: LinkType): LinkType {
  return LINK_TYPES.find((l) => l.id === t)?.inverse ?? 'relates';
}

export function defaultType(board: Board): string {
  return (board.issueTypes.find((t) => !t.isEpic) ?? board.issueTypes[0])?.id ?? 'task';
}

export function epicTypes(board: Board): Set<string> {
  return new Set(board.issueTypes.filter((t) => t.isEpic).map((t) => t.id));
}

export function isEpic(board: Board, issue: Pick<Issue, 'type'>): boolean {
  return !!board.issueTypes.find((t) => t.id === issue.type)?.isEpic;
}

export function newIssueDraft(board: Board, me: AppUser, over: Partial<IssueDraft> = {}): IssueDraft {
  const type = over.type ?? defaultType(board);
  const it = board.issueTypes.find((t) => t.id === type);
  return {
    title: '',
    description: it?.template ?? '',
    type,
    status: board.columns[0]?.id ?? 'todo',
    priority: 'medium',
    assigneeId: null,
    reporterId: me.ghId,
    labels: [],
    components: [],
    fixVersionId: null,
    epicId: null,
    storyPoints: null,
    estimate: '',
    dueDate: null,
    checklist: (it?.checklist ?? []).map((text) => ({ id: uid(8), text, done: false })),
    links: [],
    rank: Date.now(),
    ...over,
  };
}

/** Создаёт задачи-примеры шаблона (номера 1..N, связи с эпиками). */
export function buildSampleIssues(draft: BoardSetup, samples: SampleIssue[], user: AppUser): Issue[] {
  const now = Date.now();
  const byTitle = new Map<string, string>();
  const issues: Issue[] = samples.map((s, idx) => {
    const id = uid(16);
    byTitle.set(s.title, id);
    const it = draft.issueTypes.find((t) => t.id === s.type);
    const cat = draft.columns.find((c) => c.id === s.status)?.category;
    return {
      id,
      number: idx + 1,
      title: s.title,
      description: s.description ?? it?.template ?? '',
      type: s.type,
      status: s.status,
      priority: s.priority ?? 'medium',
      assigneeId: s.assignToMe ? user.ghId : null,
      reporterId: user.ghId,
      labels: s.labels ?? [],
      components: s.components ?? [],
      fixVersionId: s.version ?? null,
      epicId: null,
      storyPoints: s.storyPoints ?? null,
      estimate: s.estimate ?? '',
      dueDate: s.dueInDays !== undefined ? addDays(todayISO(), s.dueInDays) : null,
      checklist: s.checklist ? s.checklist.map(([text, done]) => ({ id: uid(8), text, done })) : (it?.checklist ?? []).map((text) => ({ id: uid(8), text, done: false })),
      links: [],
      rank: (idx + 1) * 1000,
      createdAt: now - (samples.length - idx) * 3600_000,
      updatedAt: now - (samples.length - idx) * 1800_000,
      resolvedAt: cat === 'done' ? now : null,
      createdBy: user.ghId,
    };
  });
  samples.forEach((s, idx) => {
    if (s.epic) issues[idx].epicId = byTitle.get(s.epic) ?? null;
  });
  return issues;
}

/** Формирует запись истории для изменения задачи. */
export function diffIssue(board: Board, before: Issue, patch: Partial<Issue>, allIssues: Issue[]): HistoryChange[] {
  const out: HistoryChange[] = [];
  const person = (id: string | null) => (id ? board.memberInfo[id]?.login ?? id : 'не назначен');
  const col = (id: string) => board.columns.find((c) => c.id === id)?.name ?? id;
  const type = (id: string) => board.issueTypes.find((t) => t.id === id)?.name ?? id;
  const version = (id: string | null) => (id ? board.versions.find((v) => v.id === id)?.name ?? '?' : '—');
  const epic = (id: string | null) => {
    if (!id) return '—';
    const e = allIssues.find((i) => i.id === id);
    return e ? `${board.key}-${e.number}` : '?';
  };
  const list = (v: string[]) => (v.length ? v.join(', ') : '—');
  const fmt: Partial<Record<keyof Issue, [string, (v: never) => string]>> = {
    title: ['Название', (v: string) => v],
    status: ['Статус', (v: string) => col(v)],
    type: ['Тип', (v: string) => type(v)],
    priority: ['Приоритет', (v: Priority) => priorityName(v)],
    assigneeId: ['Исполнитель', (v: string | null) => person(v)],
    reporterId: ['Автор', (v: string | null) => person(v)],
    labels: ['Метки', (v: string[]) => list(v)],
    components: ['Компоненты', (v: string[]) => list(v)],
    fixVersionId: ['Версия', (v: string | null) => version(v)],
    epicId: ['Эпик', (v: string | null) => epic(v)],
    storyPoints: ['Story points', (v: number | null) => (v === null ? '—' : String(v))],
    estimate: ['Оценка', (v: string) => v || '—'],
    dueDate: ['Срок', (v: string | null) => v ?? '—'],
    description: ['Описание', () => '…'],
  };
  for (const k of Object.keys(patch) as (keyof Issue)[]) {
    const f = fmt[k];
    if (!f) continue;
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(patch[k] ?? null);
    if (a === b) continue;
    const render = f[1] as (v: unknown) => string;
    out.push({ field: f[0], from: render(before[k] ?? null), to: render(patch[k] ?? null) });
  }
  return out;
}

/** Дополнительные поля при смене статуса (дата решения). */
export function statusSideEffects(board: Board, issue: Issue, newStatus: string): Partial<Issue> {
  const was = columnCategory(board, issue.status) === 'done';
  const now = columnCategory(board, newStatus) === 'done';
  if (!was && now) return { resolvedAt: Date.now() };
  if (was && !now) return { resolvedAt: null };
  return {};
}

// ---------------------------------------------------------------------------
// Фильтры
// ---------------------------------------------------------------------------

export interface Filters {
  text: string;
  assignees: string[]; // ghId или 'none'
  types: string[];
  priorities: Priority[];
  labels: string[];
  components: string[];
  versions: string[]; // id или 'none'
  epics: string[];
  onlyMine: boolean;
  recent: boolean;
  hideDone: boolean;
}

export const EMPTY_FILTERS: Filters = {
  text: '',
  assignees: [],
  types: [],
  priorities: [],
  labels: [],
  components: [],
  versions: [],
  epics: [],
  onlyMine: false,
  recent: false,
  hideDone: false,
};

export function filtersActive(f: Filters): boolean {
  return (
    !!f.text ||
    f.assignees.length > 0 ||
    f.types.length > 0 ||
    f.priorities.length > 0 ||
    f.labels.length > 0 ||
    f.components.length > 0 ||
    f.versions.length > 0 ||
    f.epics.length > 0 ||
    f.onlyMine ||
    f.recent ||
    f.hideDone
  );
}

export function applyFilters(board: Board, issues: Issue[], f: Filters, me: AppUser | null): Issue[] {
  const text = f.text.trim().toLowerCase();
  const weekAgo = Date.now() - 7 * 86400_000;
  return issues.filter((i) => {
    if (text) {
      const key = `${board.key}-${i.number}`.toLowerCase();
      if (!i.title.toLowerCase().includes(text) && !key.includes(text) && !i.description.toLowerCase().includes(text)) return false;
    }
    if (f.assignees.length && !f.assignees.includes(i.assigneeId ?? 'none')) return false;
    if (f.types.length && !f.types.includes(i.type)) return false;
    if (f.priorities.length && !f.priorities.includes(i.priority)) return false;
    if (f.labels.length && !i.labels.some((l) => f.labels.includes(l))) return false;
    if (f.components.length && !i.components.some((c) => f.components.includes(c))) return false;
    if (f.versions.length && !f.versions.includes(i.fixVersionId ?? 'none')) return false;
    if (f.epics.length && !f.epics.includes(i.epicId ?? 'none') && !f.epics.includes(i.id)) return false;
    if (f.onlyMine && me && i.assigneeId !== me.ghId) return false;
    if (f.recent && i.updatedAt < weekAgo) return false;
    if (f.hideDone && columnCategory(board, i.status) === 'done') return false;
    return true;
  });
}

export type SortKey = 'key' | 'title' | 'status' | 'priority' | 'assignee' | 'version' | 'points' | 'due' | 'updated' | 'type';

export function sortIssues(board: Board, issues: Issue[], key: SortKey, dir: 1 | -1): Issue[] {
  const colIdx = new Map(board.columns.map((c, i) => [c.id, i]));
  const verIdx = new Map(board.versions.map((v, i) => [v.id, i]));
  const typeIdx = new Map(board.issueTypes.map((t, i) => [t.id, i]));
  const val = (i: Issue): string | number => {
    switch (key) {
      case 'key':
        return i.number;
      case 'title':
        return i.title.toLowerCase();
      case 'status':
        return colIdx.get(i.status) ?? 99;
      case 'priority':
        return PRIORITY_ORDER[i.priority];
      case 'assignee':
        return i.assigneeId ? board.memberInfo[i.assigneeId]?.login?.toLowerCase() ?? 'zzz' : '~';
      case 'version':
        return i.fixVersionId ? verIdx.get(i.fixVersionId) ?? 99 : 999;
      case 'points':
        return i.storyPoints ?? -1;
      case 'due':
        return i.dueDate ?? '9999';
      case 'updated':
        return i.updatedAt;
      case 'type':
        return typeIdx.get(i.type) ?? 99;
    }
  };
  return [...issues].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.number - b.number;
  });
}

// ---------------------------------------------------------------------------
// Экспорт / импорт
// ---------------------------------------------------------------------------

export interface BoardExport {
  format: 'kanban-board';
  version: 1;
  exportedAt: string;
  board: Omit<Board, 'id'>;
  issues: Issue[];
}

export function exportBoard(board: Board, issues: Issue[]): BoardExport {
  const { id: _id, ...rest } = board;
  void _id;
  return { format: 'kanban-board', version: 1, exportedAt: new Date().toISOString(), board: rest, issues };
}

/** Готовит данные экспорта к импорту: новые id, переносит связи. */
export function prepareImport(data: BoardExport, me: AppUser): { draft: BoardSetup; name: string; key: string; description: string; issues: Issue[] } {
  if (data?.format !== 'kanban-board' || !data.board || !Array.isArray(data.issues)) {
    throw new Error('Это не файл экспорта доски');
  }
  const b = data.board;
  const idMap = new Map<string, string>();
  data.issues.forEach((i) => idMap.set(i.id, uid(16)));
  // Участники в новую доску не переносятся — исполнителей кроме себя сбрасываем.
  const issues: Issue[] = data.issues.map((i) => ({
    ...i,
    id: idMap.get(i.id)!,
    epicId: i.epicId ? idMap.get(i.epicId) ?? null : null,
    links: (i.links ?? []).filter((l) => idMap.has(l.issueId)).map((l) => ({ ...l, issueId: idMap.get(l.issueId)! })),
    assigneeId: i.assigneeId === me.ghId ? me.ghId : null,
    reporterId: me.ghId,
    createdBy: me.ghId,
  }));
  return {
    draft: {
      template: b.template ?? 'blank',
      icon: b.icon ?? '📋',
      color: b.color ?? '#626F86',
      columns: b.columns,
      issueTypes: b.issueTypes,
      labels: b.labels ?? [],
      components: b.components ?? [],
      versions: b.versions ?? [],
    },
    name: b.name,
    key: b.key,
    description: b.description ?? '',
    issues,
  };
}
