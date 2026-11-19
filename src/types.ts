export type Role = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';

export type ColumnCategory = 'todo' | 'progress' | 'done';

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export interface AppUser {
  uid: string;
  /** Numeric GitHub ID (as a string) — permissions are granted by it. */
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
  /** WIP limit (0 = unlimited). */
  wip: number;
}

export interface IssueType {
  id: string;
  name: string;
  /** Icon key from TYPE_GLYPHS (or an emoji). */
  icon: string;
  color: string;
  isEpic?: boolean;
  /** Description template, pre-filled when creating an issue of this type. */
  template?: string;
  /** Default checklist items. */
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

/**
 * Issue fields a board can rename, plus "details" — the title of the fields panel in the issue dialog.
 * The keys match the Issue properties (and the field keys of history entries).
 */
export type FieldKey = 'details' | 'assigneeId' | 'reporterId' | 'priority' | 'type' | 'labels' | 'components' | 'fixVersionId' | 'epicId' | 'storyPoints' | 'estimate' | 'dueDate';

/** Custom field names of a board (only the renamed ones; the rest use the template's names). */
export type FieldNames = Partial<Record<FieldKey, string>>;

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
  fieldNames: FieldNames;
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

/** Board structure without name, key and description (what a template provides). */
export type BoardSetup = Omit<BoardDraft, 'name' | 'key' | 'description'>;
