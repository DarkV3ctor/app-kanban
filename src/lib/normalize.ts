import type {
  Board,
  ChecklistItem,
  Column,
  ColumnCategory,
  Comment,
  FieldKey,
  FieldNames,
  HistoryChange,
  HistoryEntry,
  Issue,
  IssueLink,
  IssueType,
  LinkType,
  MemberInfo,
  Priority,
  Role,
  Version,
  VersionStatus,
} from '../types';

/*
 * Data read from Firestore (or from an import file) is coerced into the shapes the UI expects.
 * The security rules validate writes too, but the UI must not crash for everyone because of
 * one malformed document, so every field is checked again on the way in.
 */

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const int = (v: unknown, def = 0): number => {
  const n = Math.round(num(v, def));
  return Number.isSafeInteger(n) ? n : def;
};
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Largest time a Date can hold: a timestamp beyond it would make date formatting throw. */
const MAX_TIME = 8.64e15;
const timeOrNull = (v: unknown): number | null => (typeof v === 'number' && Math.abs(v) <= MAX_TIME ? Math.round(v) : null);
const time = (v: unknown): number => timeOrNull(v) ?? 0;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string');
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], def: T): T => (allowed.includes(v as T) ? (v as T) : def);

const ROLES: readonly Role[] = ['owner', 'admin', 'editor', 'commenter', 'viewer'];
const CATEGORIES: readonly ColumnCategory[] = ['todo', 'progress', 'done'];
const PRIORITIES: readonly Priority[] = ['highest', 'high', 'medium', 'low', 'lowest'];
const VERSION_STATUSES: readonly VersionStatus[] = ['unreleased', 'released', 'archived'];
const LINK_TYPES: readonly LinkType[] = ['blocks', 'blocked_by', 'relates', 'duplicates', 'duplicated_by'];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Renamable issue fields and the longest name (see lib/fields.ts; keep in sync with validFieldNames() in firestore.rules). */
export const FIELD_NAME_KEYS: readonly FieldKey[] = ['details', 'assigneeId', 'reporterId', 'priority', 'type', 'labels', 'components', 'fixVersionId', 'epicId', 'storyPoints', 'estimate', 'dueDate'];
export const MAX_FIELD_NAME = 40;

/** A color that is safe to put into CSS: only #rrggbb is accepted. */
export function safeColor(v: unknown, def = '#626F86'): string {
  return typeof v === 'string' && HEX_COLOR.test(v) ? v : def;
}

export function normalizeMemberInfo(v: unknown): MemberInfo {
  const o = obj(v);
  const login = str(o.login);
  return { login, name: str(o.name, login), avatarUrl: str(o.avatarUrl) };
}

function normalizeColumn(v: unknown, i: number): Column {
  const o = obj(v);
  return { id: str(o.id, `col${i}`), name: str(o.name, '?'), category: oneOf(o.category, CATEGORIES, 'todo'), wip: Math.max(0, int(o.wip)) };
}

function normalizeIssueType(v: unknown, i: number): IssueType {
  const o = obj(v);
  const t: IssueType = { id: str(o.id, `type${i}`), name: str(o.name, '?'), icon: str(o.icon, 'task'), color: safeColor(o.color) };
  if (o.isEpic === true) t.isEpic = true;
  if (typeof o.template === 'string') t.template = o.template;
  if (Array.isArray(o.checklist)) t.checklist = strList(o.checklist);
  return t;
}

function normalizeVersion(v: unknown, i: number): Version {
  const o = obj(v);
  return {
    id: str(o.id, `ver${i}`),
    name: str(o.name, '?'),
    description: str(o.description),
    status: oneOf(o.status, VERSION_STATUSES, 'unreleased'),
    startDate: strOrNull(o.startDate),
    releaseDate: strOrNull(o.releaseDate),
  };
}

/** Custom field names: known keys with non-empty text only (see lib/fields.ts). */
function normalizeFieldNames(v: unknown): FieldNames {
  const o = obj(v);
  const out: FieldNames = {};
  for (const k of FIELD_NAME_KEYS) {
    const name = str(o[k]).trim().slice(0, MAX_FIELD_NAME);
    if (name) out[k] = name;
  }
  return out;
}

/** Columns, types, labels, components, versions and field names (the part of a board a template or import provides). */
export function normalizeBoardSetup(o: Raw) {
  const columns = list(o.columns).map(normalizeColumn);
  return {
    fieldNames: normalizeFieldNames(o.fieldNames),
    template: str(o.template, 'blank'),
    icon: str(o.icon, '📋'),
    color: safeColor(o.color),
    columns: columns.length ? columns : [{ id: 'todo', name: 'To do', category: 'todo' as const, wip: 0 }],
    issueTypes: list(o.issueTypes).map(normalizeIssueType),
    labels: strList(o.labels),
    components: strList(o.components),
    versions: list(o.versions).map(normalizeVersion),
  };
}

export function normalizeBoard(raw: unknown, id: string): Board {
  const o = obj(raw);
  // Null-prototype maps: looking up an id such as "constructor" must not find an Object.prototype member.
  const members: Record<string, Role> = Object.create(null);
  for (const [k, v] of Object.entries(obj(o.members))) {
    if (ROLES.includes(v as Role)) members[k] = v as Role;
  }
  const memberInfo: Record<string, MemberInfo> = Object.create(null);
  for (const [k, v] of Object.entries(obj(o.memberInfo))) memberInfo[k] = normalizeMemberInfo(v);
  return {
    ...normalizeBoardSetup(o),
    id,
    name: str(o.name, '?'),
    key: str(o.key, 'KEY'),
    description: str(o.description),
    ownerId: str(o.ownerId),
    members,
    memberIds: strList(o.memberIds),
    memberInfo,
    issueCounter: int(o.issueCounter),
    createdAt: time(o.createdAt),
    updatedAt: time(o.updatedAt),
  };
}

function normalizeChecklistItem(v: unknown, i: number): ChecklistItem {
  const o = obj(v);
  return { id: str(o.id, `item${i}`), text: str(o.text), done: o.done === true };
}

function normalizeLink(v: unknown): IssueLink | null {
  const o = obj(v);
  if (typeof o.issueId !== 'string' || !LINK_TYPES.includes(o.type as LinkType)) return null;
  return { type: o.type as LinkType, issueId: o.issueId };
}

export function normalizeIssue(raw: unknown, id: string): Issue {
  const o = obj(raw);
  return {
    id,
    number: Math.max(1, int(o.number, 1)),
    title: str(o.title, '?') || '?',
    description: str(o.description),
    type: str(o.type, 'task'),
    status: str(o.status),
    priority: oneOf(o.priority, PRIORITIES, 'medium'),
    assigneeId: strOrNull(o.assigneeId),
    reporterId: str(o.reporterId),
    labels: strList(o.labels),
    components: strList(o.components),
    fixVersionId: strOrNull(o.fixVersionId),
    epicId: strOrNull(o.epicId),
    storyPoints: numOrNull(o.storyPoints),
    estimate: str(o.estimate),
    dueDate: strOrNull(o.dueDate),
    checklist: list(o.checklist).map(normalizeChecklistItem),
    links: list(o.links)
      .map(normalizeLink)
      .filter((l): l is IssueLink => l !== null),
    rank: num(o.rank),
    createdAt: time(o.createdAt),
    updatedAt: time(o.updatedAt),
    resolvedAt: timeOrNull(o.resolvedAt),
    createdBy: str(o.createdBy),
  };
}

export function normalizeComment(raw: unknown, id: string): Comment {
  const o = obj(raw);
  return { id, authorId: str(o.authorId), body: str(o.body), createdAt: time(o.createdAt), editedAt: timeOrNull(o.editedAt) };
}

function normalizeChange(v: unknown): HistoryChange {
  const o = obj(v);
  return { field: str(o.field), from: str(o.from), to: str(o.to) };
}

export function normalizeHistoryEntry(raw: unknown, id: string): HistoryEntry {
  const o = obj(raw);
  return { id, actorId: str(o.actorId), at: time(o.at), changes: list(o.changes).map(normalizeChange) };
}
