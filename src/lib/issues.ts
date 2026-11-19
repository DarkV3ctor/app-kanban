import type { AppUser, Board, BoardDraft, BoardSetup, HistoryChange, Issue, IssueDraft, LinkType, Priority } from '../types';
import type { SampleIssue } from '../templates';
import { t, tk } from '../i18n';
import { PRIORITY_ORDER, addDays, columnCategory, priorityName, sanitizeKey, todayISO, uid } from './utils';
import { normalizeBoardSetup, normalizeIssue } from './normalize';
import { fieldName, isFieldKey } from './fields';

export const LINK_TYPES: { id: LinkType; name: string; inverse: LinkType }[] = [
  { id: 'blocks', name: tk('blocks'), inverse: 'blocked_by' },
  { id: 'blocked_by', name: tk('is blocked by'), inverse: 'blocks' },
  { id: 'relates', name: tk('relates to'), inverse: 'relates' },
  { id: 'duplicates', name: tk('duplicates'), inverse: 'duplicated_by' },
  { id: 'duplicated_by', name: tk('is duplicated by'), inverse: 'duplicates' },
];

export function linkName(type: LinkType | string): string {
  const found = LINK_TYPES.find((l) => l.id === type);
  return found ? t(found.name) : type;
}

export function inverseLink(type: LinkType): LinkType {
  return LINK_TYPES.find((l) => l.id === type)?.inverse ?? 'relates';
}

export function defaultType(board: Board): string {
  return (board.issueTypes.find((x) => !x.isEpic) ?? board.issueTypes[0])?.id ?? 'task';
}

export function isEpic(board: Board, issue: Pick<Issue, 'type'>): boolean {
  return !!board.issueTypes.find((x) => x.id === issue.type)?.isEpic;
}

export function newIssueDraft(board: Board, me: AppUser, over: Partial<IssueDraft> = {}): IssueDraft {
  const type = over.type ?? defaultType(board);
  const it = board.issueTypes.find((x) => x.id === type);
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

/** Build a template's sample issues (numbered 1..N, linked to their epics). */
export function buildSampleIssues(setup: BoardSetup, samples: SampleIssue[], user: AppUser): Issue[] {
  const now = Date.now();
  const byTitle = new Map<string, string>();
  const issues: Issue[] = samples.map((s, idx) => {
    const id = uid(16);
    byTitle.set(s.title, id);
    const it = setup.issueTypes.find((x) => x.id === s.type);
    const cat = setup.columns.find((c) => c.id === s.status)?.category;
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
      checklist: s.checklist
        ? s.checklist.map(([text, done]) => ({ id: uid(8), text, done }))
        : (it?.checklist ?? []).map((text) => ({ id: uid(8), text, done: false })),
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

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * History entries store field *keys* and language-neutral values (logins, ids, names),
 * so they render in the viewer's language.
 */
const FIELD_LABELS: Record<string, string> = {
  title: tk('Summary'),
  status: tk('Status'),
  description: tk('Description'),
  links: tk('Links'),
};

/** The name of a history entry's field, as the board calls it (renamable fields use fieldName()). */
export function fieldLabel(board: Board, field: string): string {
  if (isFieldKey(field) && field !== 'details') return fieldName(board, field);
  // Own keys only: a history entry with the field "__proto__" must not resolve to Object.prototype.
  return Object.hasOwn(FIELD_LABELS, field) ? t(FIELD_LABELS[field]) : field;
}

/** Encodes a link change as a neutral value: "link:<type> <KEY>". */
export function linkValue(type: LinkType, key: string): string {
  return `link:${type} ${key}`;
}

export function renderHistoryValue(field: string, value: string): string {
  if (!value) return field === 'assigneeId' ? t('Unassigned') : '—';
  if (field === 'priority') return priorityName(value);
  const m = /^link:(\w+) (.+)$/.exec(value);
  if (m) return `${linkName(m[1])} ${m[2]}`;
  return value;
}

export function diffIssue(board: Board, before: Issue, patch: Partial<Issue>, allIssues: Issue[]): HistoryChange[] {
  const person = (id: string | null) => (id ? board.memberInfo[id]?.login ?? id : '');
  const column = (id: string) => board.columns.find((c) => c.id === id)?.name ?? id;
  const type = (id: string) => board.issueTypes.find((x) => x.id === id)?.name ?? id;
  const version = (id: string | null) => (id ? board.versions.find((v) => v.id === id)?.name ?? '?' : '');
  const epic = (id: string | null) => {
    if (!id) return '';
    const e = allIssues.find((i) => i.id === id);
    return e ? `${board.key}-${e.number}` : '?';
  };
  const list = (v: string[]) => v.join(', ');
  const fmt: Partial<Record<keyof Issue, (v: never) => string>> = {
    title: (v: string) => v,
    status: (v: string) => column(v),
    type: (v: string) => type(v),
    priority: (v: Priority) => v,
    assigneeId: (v: string | null) => person(v),
    reporterId: (v: string | null) => person(v),
    labels: (v: string[]) => list(v),
    components: (v: string[]) => list(v),
    fixVersionId: (v: string | null) => version(v),
    epicId: (v: string | null) => epic(v),
    storyPoints: (v: number | null) => (v === null ? '' : String(v)),
    estimate: (v: string) => v,
    dueDate: (v: string | null) => v ?? '',
    description: () => '',
  };
  const out: HistoryChange[] = [];
  for (const k of Object.keys(patch) as (keyof Issue)[]) {
    const render = fmt[k] as ((v: unknown) => string) | undefined;
    if (!render) continue;
    if (JSON.stringify(before[k] ?? null) === JSON.stringify(patch[k] ?? null)) continue;
    out.push({ field: k, from: render(before[k] ?? null), to: render(patch[k] ?? null) });
  }
  return out;
}

/** Extra fields to set when the status changes (resolution date). */
export function statusSideEffects(board: Board, issue: Issue, newStatus: string): Partial<Issue> {
  const was = columnCategory(board, issue.status) === 'done';
  const now = columnCategory(board, newStatus) === 'done';
  if (!was && now) return { resolvedAt: Date.now() };
  if (was && !now) return { resolvedAt: null };
  return {};
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface Filters {
  text: string;
  assignees: string[]; // ghId or 'none'
  types: string[];
  priorities: Priority[];
  labels: string[];
  components: string[];
  versions: string[]; // id or 'none'
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
  const typeIdx = new Map(board.issueTypes.map((x, i) => [x.id, i]));
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
// Export / import
// ---------------------------------------------------------------------------

export interface BoardExport {
  format: 'kanban-board';
  version: 1;
  exportedAt: string;
  board: BoardDraft;
  issues: Issue[];
}

/**
 * The file is meant to be shared (as a template, or to move a board), so it carries no people:
 * no member list, names or GitHub IDs. The import does not use them either — it keeps only
 * assignments to the person importing, so assignments to yourself (`me`) are kept.
 */
export function exportBoard(board: Board, issues: Issue[], me: string): BoardExport {
  const { name, key, description, template, icon, color, columns, issueTypes, labels, components, versions, fieldNames } = board;
  return {
    format: 'kanban-board',
    version: 1,
    exportedAt: new Date().toISOString(),
    board: { name, key, description, template, icon, color, columns, issueTypes, labels, components, versions, fieldNames },
    issues: issues.map((i) => ({ ...i, assigneeId: i.assigneeId === me ? me : null, reporterId: '', createdBy: '' })),
  };
}

/**
 * Prepare an export file for import: the file is untrusted, so every field is normalized and
 * clipped to the limits of the security rules; issues get new ids (links remapped) and unique numbers.
 */
export function prepareImport(data: unknown, me: AppUser): { draft: BoardSetup; name: string; key: string; description: string; issues: Issue[] } {
  const d = (data ?? {}) as Partial<Record<keyof BoardExport, unknown>>;
  if (d.format !== 'kanban-board' || !d.board || typeof d.board !== 'object' || !Array.isArray(d.issues)) {
    throw new Error(t('This is not a board export file'));
  }
  const b = d.board as Record<string, unknown>;
  const draft = normalizeBoardSetup(b);
  // Clipped to the limits of validBoard() in firestore.rules, otherwise the whole import is rejected.
  draft.template = draft.template.slice(0, 50);
  draft.icon = [...draft.icon].slice(0, 4).join('');
  draft.columns = draft.columns.slice(0, 50);
  draft.issueTypes = draft.issueTypes.slice(0, 50);
  draft.labels = draft.labels.slice(0, 500);
  draft.components = draft.components.slice(0, 500);
  draft.versions = draft.versions.slice(0, 500);
  const columnIds = new Set(draft.columns.map((c) => c.id));
  const versionIds = new Set(draft.versions.map((v) => v.id));

  const source = d.issues.slice(0, MAX_IMPORT_ISSUES).map((x, i) => {
    const oldId = typeof (x as { id?: unknown })?.id === 'string' ? (x as { id: string }).id : `#${i}`;
    return { oldId, issue: normalizeIssue(x, oldId) };
  });
  const idMap = new Map(source.map((s) => [s.oldId, uid(16)]));

  // Issue numbers must be unique and small enough for the board counter to keep counting:
  // duplicates and out-of-range numbers get the next free numbers.
  const numberOk = (n: number) => n >= 1 && n <= MAX_ISSUE_NUMBER;
  let maxNumber = source.reduce((m, s) => (numberOk(s.issue.number) ? Math.max(m, s.issue.number) : m), 0);
  const usedNumbers = new Set<number>();

  // Members are not carried over, so every assignee except yourself is cleared.
  const issues: Issue[] = source.map(({ oldId, issue: i }) => {
    const number = !numberOk(i.number) || usedNumbers.has(i.number) ? ++maxNumber : i.number;
    usedNumbers.add(number);
    return {
      ...i,
      id: idMap.get(oldId)!,
      number,
      title: i.title.slice(0, 500),
      description: i.description.slice(0, 100_000),
      status: columnIds.has(i.status) ? i.status : draft.columns[0].id,
      estimate: i.estimate.slice(0, 50),
      labels: i.labels.slice(0, 50),
      components: i.components.slice(0, 50),
      checklist: i.checklist.slice(0, 200),
      fixVersionId: i.fixVersionId && versionIds.has(i.fixVersionId) ? i.fixVersionId : null,
      epicId: i.epicId ? idMap.get(i.epicId) ?? null : null,
      links: i.links
        .filter((l) => idMap.has(l.issueId))
        .slice(0, 200)
        .map((l) => ({ ...l, issueId: idMap.get(l.issueId)! })),
      assigneeId: i.assigneeId === me.ghId ? me.ghId : null,
      reporterId: me.ghId,
      createdBy: me.ghId,
    };
  });
  return {
    draft,
    name: (typeof b.name === 'string' ? b.name.trim() : '').slice(0, 180) || t('Imported board'),
    key: sanitizeKey(typeof b.key === 'string' ? b.key : '') || 'IMP',
    description: (typeof b.description === 'string' ? b.description : '').slice(0, 5000),
    issues,
  };
}

/** Large enough for any real board, small enough for the import to finish in reasonable time. */
const MAX_IMPORT_ISSUES = 5000;

/** Imported issue numbers above this are renumbered. */
const MAX_ISSUE_NUMBER = 1_000_000_000;
