export type Role = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';

export type ColumnCategory = 'todo' | 'progress' | 'done';

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export interface AppUser {
  uid: string;
  /** Числовой GitHub ID (строкой) — по нему выдаются права. */
  ghId: string;
  login: string;
  name: string;
  avatarUrl: string;
}

export interface MemberInfo {
  login: string;
  name: string;
  avatarUrl: string;
}

export interface Column {
  id: string;
  name: string;
  category: ColumnCategory;
  /** Лимит WIP (0 — без лимита). */
  wip: number;
}

export interface IssueType {
  id: string;
  name: string;
  /** Ключ иконки из набора Icons (или эмодзи). */
  icon: string;
  color: string;
  isEpic?: boolean;
  /** Шаблон описания, подставляется при создании задачи этого типа. */
  template?: string;
  /** Пункты чек-листа по умолчанию. */
  checklist?: string[];
}

export type VersionStatus = 'unreleased' | 'released' | 'archived';

export interface Version {
  id: string;
  name: string;
  description: string;
  status: VersionStatus;
  startDate: string | null;
  releaseDate: string | null;
}

export interface Board {
  id: string;
  name: string;
  key: string;
  description: string;
  template: string;
  icon: string;
  color: string;
  ownerId: string;
  members: Record<string, Role>;
  memberIds: string[];
  memberInfo: Record<string, MemberInfo>;
  columns: Column[];
  issueTypes: IssueType[];
  labels: string[];
  components: string[];
  versions: Version[];
  issueCounter: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type LinkType = 'blocks' | 'blocked_by' | 'relates' | 'duplicates' | 'duplicated_by';

export interface IssueLink {
  type: LinkType;
  issueId: string;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string;
  labels: string[];
  components: string[];
  fixVersionId: string | null;
  epicId: string | null;
  storyPoints: number | null;
  estimate: string;
  dueDate: string | null;
  checklist: ChecklistItem[];
  links: IssueLink[];
  rank: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  createdBy: string;
}

export type IssueDraft = Omit<Issue, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'createdBy' | 'resolvedAt'> & {
  resolvedAt?: number | null;
};

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: number;
  editedAt: number | null;
}

export interface HistoryChange {
  field: string;
  from: string;
  to: string;
}

export interface HistoryEntry {
  id: string;
  actorId: string;
  at: number;
  changes: HistoryChange[];
}

export type BoardDraft = Omit<Board, 'id' | 'ownerId' | 'members' | 'memberIds' | 'memberInfo' | 'issueCounter' | 'createdAt' | 'updatedAt'>;

/** Структура доски без названия, ключа и описания (то, что даёт шаблон). */
export type BoardSetup = Omit<BoardDraft, 'name' | 'key' | 'description'>;
