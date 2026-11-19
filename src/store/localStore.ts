import type { AppUser, Board, Comment, HistoryEntry, Issue } from '../types';
import { uid } from '../lib/utils';
import { normalizeBoard, normalizeComment, normalizeHistoryEntry, normalizeIssue } from '../lib/normalize';
import { t } from '../i18n';
import type { CreatorEntry, Store } from './types';

/**
 * Demo storage: everything lives in this browser's localStorage.
 * Used until a Firebase config is set in public/config.js.
 */

interface LocalDB {
  boards: Record<string, Board>;
  issues: Record<string, Record<string, Issue>>;
  comments: Record<string, Comment[]>;
  history: Record<string, HistoryEntry[]>;
}

const KEY = 'kb-local-db-v1';
const USER_KEY = 'kb-local-user-v1';

export const LOCAL_USER: AppUser = {
  uid: 'local',
  ghId: 'local',
  login: 'demo',
  name: t('You (demo)'),
  avatarUrl: '',
};

function load(): LocalDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as LocalDB;
  } catch {
    /* ignore */
  }
  return { boards: {}, issues: {}, comments: {}, history: {} };
}

let db: LocalDB = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('localStorage is unavailable', e);
  }
  emit();
}

function emit() {
  // async, like a real backend
  queueMicrotask(() => listeners.forEach((l) => l()));
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    db = load();
    emit();
  }
});

function sub(fn: () => void) {
  listeners.add(fn);
  queueMicrotask(fn);
  return () => {
    listeners.delete(fn);
  };
}

const ck = (boardId: string, issueId: string) => `${boardId}/${issueId}`;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function boardOrThrow(boardId: string): Board {
  const b = db.boards[boardId];
  if (!b) throw new Error(t('Board not found'));
  return b;
}

const updateIssues: Store['updateIssues'] = async (boardId, user, updates) => {
  // All or nothing, like a Firestore batch.
  if (updates.some((u) => !db.issues[boardId]?.[u.id])) throw new Error(t('Issue not found'));
  for (const { id, patch, changes } of updates) {
    db.issues[boardId][id] = { ...db.issues[boardId][id], ...clone(patch), id, updatedAt: Date.now() };
    if (changes.length) {
      (db.history[ck(boardId, id)] ??= []).push({ id: uid(), actorId: user.ghId, at: Date.now(), changes });
    }
  }
  save();
};

function demoUser(): AppUser {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return { ...LOCAL_USER, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return LOCAL_USER;
}

export const localStore: Store = {
  mode: 'local',

  onAuth(cb) {
    let signedOut = false;
    try {
      signedOut = localStorage.getItem('kb-local-signed-out') === '1';
    } catch {
      /* ignore */
    }
    queueMicrotask(() => cb(signedOut ? null : demoUser()));
    const h = () => cb(localStorage.getItem('kb-local-signed-out') === '1' ? null : demoUser());
    window.addEventListener('kb-local-auth', h);
    return () => window.removeEventListener('kb-local-auth', h);
  },
  async signIn() {
    localStorage.removeItem('kb-local-signed-out');
    window.dispatchEvent(new Event('kb-local-auth'));
  },
  async signOut() {
    localStorage.setItem('kb-local-signed-out', '1');
    window.dispatchEvent(new Event('kb-local-auth'));
  },
  async consumeAuthError() {
    return null;
  },

  async canCreateBoards() {
    return true;
  },
  subscribeCreators(cb) {
    queueMicrotask(() => cb([] as CreatorEntry[]));
    return () => {};
  },
  async addCreator() {
    throw new Error(t('Board creation is not restricted in demo mode'));
  },
  async removeCreator() {},

  subscribeBoards(user, cb) {
    return sub(() => {
      const list = Object.values(db.boards).filter((b) => b.memberIds.includes(user.ghId));
      cb(list.map((b) => normalizeBoard(clone(b), b.id)));
    });
  },
  subscribeBoard(boardId, cb) {
    return sub(() => cb(db.boards[boardId] ? normalizeBoard(clone(db.boards[boardId]), boardId) : null));
  },
  async countIssues(boardId) {
    return Object.keys(db.issues[boardId] ?? {}).length;
  },
  async createBoard(user, input) {
    const id = uid(16);
    const now = Date.now();
    const board: Board = {
      ...input.draft,
      id,
      name: input.name,
      key: input.key,
      description: input.description,
      ownerId: user.ghId,
      members: { [user.ghId]: 'owner' },
      memberIds: [user.ghId],
      memberInfo: { [user.ghId]: { login: user.login, name: user.name, avatarUrl: user.avatarUrl } },
      issueCounter: input.issues.reduce((m, i) => Math.max(m, i.number), 0),
      createdAt: now,
      updatedAt: now,
    };
    db.boards[id] = board;
    db.issues[id] = {};
    for (const i of input.issues) db.issues[id][i.id] = { ...i };
    save();
    return id;
  },
  async updateBoard(boardId, patch) {
    const b = db.boards[boardId];
    if (!b) throw new Error(t('Board not found'));
    db.boards[boardId] = { ...b, ...clone(patch), updatedAt: Date.now() };
    save();
  },
  async addMember(boardId, u, role) {
    const b = boardOrThrow(boardId);
    b.members[u.id] = role;
    if (!b.memberIds.includes(u.id)) b.memberIds.push(u.id);
    b.memberInfo[u.id] = { login: u.login, name: u.name, avatarUrl: u.avatarUrl };
    b.updatedAt = Date.now();
    save();
  },
  async setMemberRole(boardId, ghId, role) {
    const b = boardOrThrow(boardId);
    b.members[ghId] = role;
    b.updatedAt = Date.now();
    save();
  },
  async removeMember(boardId, ghId, forget = []) {
    const b = boardOrThrow(boardId);
    delete b.members[ghId];
    for (const id of [ghId, ...forget]) delete b.memberInfo[id];
    b.memberIds = b.memberIds.filter((x) => x !== ghId);
    b.updatedAt = Date.now();
    save();
  },
  async transferOwnership(boardId, fromId, toId) {
    const b = boardOrThrow(boardId);
    if (!b.memberIds.includes(toId)) throw new Error(t('Board not found'));
    b.ownerId = toId;
    b.members[toId] = 'owner';
    b.members[fromId] = 'admin';
    b.updatedAt = Date.now();
    save();
  },
  async deleteBoard(boardId) {
    delete db.boards[boardId];
    const issues = db.issues[boardId] ?? {};
    for (const iid of Object.keys(issues)) {
      delete db.comments[ck(boardId, iid)];
      delete db.history[ck(boardId, iid)];
    }
    delete db.issues[boardId];
    save();
  },

  subscribeIssues(boardId, cb) {
    return sub(() => cb(Object.values(db.issues[boardId] ?? {}).map((i) => normalizeIssue(clone(i), i.id))));
  },
  async createIssue(boardId, user, draft) {
    const b = db.boards[boardId];
    if (!b) throw new Error(t('Board not found'));
    const number = b.issueCounter + 1;
    b.issueCounter = number;
    const now = Date.now();
    const issue: Issue = {
      ...clone(draft),
      id: uid(16),
      number,
      createdAt: now,
      updatedAt: now,
      createdBy: user.ghId,
      resolvedAt: draft.resolvedAt ?? null,
    };
    (db.issues[boardId] ??= {})[issue.id] = issue;
    save();
    return clone(issue);
  },
  updateIssue: (boardId, issueId, patch, user, changes) => updateIssues(boardId, user, [{ id: issueId, patch, changes }]),
  updateIssues,
  async deleteIssue(boardId, issueId) {
    delete db.issues[boardId]?.[issueId];
    delete db.comments[ck(boardId, issueId)];
    delete db.history[ck(boardId, issueId)];
    save();
  },

  subscribeComments(boardId, issueId, cb) {
    return sub(() => cb((db.comments[ck(boardId, issueId)] ?? []).map((c) => normalizeComment(clone(c), c.id))));
  },
  async addComment(boardId, issueId, user, body) {
    (db.comments[ck(boardId, issueId)] ??= []).push({ id: uid(), authorId: user.ghId, body, createdAt: Date.now(), editedAt: null });
    save();
  },
  async updateComment(boardId, issueId, commentId, body) {
    const list = db.comments[ck(boardId, issueId)] ?? [];
    const c = list.find((x) => x.id === commentId);
    if (c) {
      c.body = body;
      c.editedAt = Date.now();
      save();
    }
  },
  async deleteComment(boardId, issueId, commentId) {
    const k = ck(boardId, issueId);
    db.comments[k] = (db.comments[k] ?? []).filter((c) => c.id !== commentId);
    save();
  },

  subscribeHistory(boardId, issueId, cb) {
    return sub(() => cb((db.history[ck(boardId, issueId)] ?? []).map((h) => normalizeHistoryEntry(clone(h), h.id))));
  },
};
