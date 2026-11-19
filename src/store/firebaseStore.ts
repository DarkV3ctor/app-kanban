import { initializeApp } from 'firebase/app';
import {
  GithubAuthProvider,
  browserLocalPersistence,
  getAdditionalUserInfo,
  initializeAuth,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import type { AppUser, Board, Comment, HistoryEntry, Issue } from '../types';
import type { FirebaseWebConfig } from '../config';
import { config } from '../config';
import { lookupGitHubUserById } from '../lib/github';
import { uid } from '../lib/utils';
import type { CreatorEntry, Store } from './types';

const PROFILE_KEY = (id: string) => `kb-gh-profile-${id}`;

function readProfile(ghId: string): Partial<AppUser> | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY(ghId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(ghId: string, p: Partial<AppUser>) {
  try {
    localStorage.setItem(PROFILE_KEY(ghId), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function githubId(user: User): string | null {
  return user.providerData.find((p) => p.providerId === 'github.com')?.uid ?? null;
}

async function toAppUser(user: User): Promise<AppUser> {
  const ghId = githubId(user) ?? user.uid;
  let prof = readProfile(ghId);
  if (!prof?.login) {
    const gh = await lookupGitHubUserById(ghId);
    if (gh) {
      prof = { login: gh.login, name: gh.name, avatarUrl: gh.avatarUrl };
      writeProfile(ghId, prof);
    }
  }
  return {
    uid: user.uid,
    ghId,
    login: prof?.login ?? user.displayName ?? 'user',
    name: prof?.name || user.displayName || prof?.login || 'Пользователь',
    avatarUrl: prof?.avatarUrl || user.photoURL || '',
  };
}

function err(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return new Error('Нет доступа (permission-denied)');
  return e instanceof Error ? e : new Error(String(e));
}

/** Firestore не принимает undefined — чистим объект. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function createFirebaseStore(cfg: FirebaseWebConfig): Store {
  const app = initializeApp(cfg);
  const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  let fs: Firestore;
  try {
    fs = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  }

  const boardRef = (id: string) => doc(fs, 'boards', id);
  const issuesCol = (boardId: string) => collection(fs, 'boards', boardId, 'issues');
  const issueRef = (boardId: string, issueId: string) => doc(fs, 'boards', boardId, 'issues', issueId);
  const commentsCol = (b: string, i: string) => collection(fs, 'boards', b, 'issues', i, 'comments');
  const historyCol = (b: string, i: string) => collection(fs, 'boards', b, 'issues', i, 'history');

  async function deleteRefs(refs: DocumentReference[]) {
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(fs);
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }

  return {
    mode: 'firebase',

    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => {
        if (!u) return cb(null);
        toAppUser(u).then(cb, () => cb(null));
      });
    },

    async signIn() {
      const provider = new GithubAuthProvider();
      provider.setCustomParameters({ allow_signup: 'true' });
      try {
        const res = await signInWithPopup(auth, provider);
        const info = getAdditionalUserInfo(res);
        const ghId = githubId(res.user);
        if (ghId && info?.username) {
          const profile = info.profile as { name?: string; avatar_url?: string } | null;
          writeProfile(ghId, { login: info.username, name: profile?.name || info.username, avatarUrl: profile?.avatar_url || res.user.photoURL || '' });
        }
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        if (code === 'auth/unauthorized-domain') {
          throw new Error(`Домен ${location.hostname} не добавлен в Firebase → Authentication → Settings → Authorized domains`);
        }
        if (code === 'auth/operation-not-allowed') {
          throw new Error('Вход через GitHub не включён в Firebase → Authentication → Sign-in method');
        }
        throw err(e);
      }
    },

    async signOut() {
      await fbSignOut(auth);
    },

    async canCreateBoards(user) {
      if (config.appAdmins.includes(user.ghId)) return true;
      try {
        const snap = await getDoc(doc(fs, 'creators', user.ghId));
        return snap.exists();
      } catch {
        return false;
      }
    },
    subscribeCreators(cb, onErr) {
      return onSnapshot(
        collection(fs, 'creators'),
        (s) => cb(s.docs.map((d) => ({ ghId: d.id, ...(d.data() as Omit<CreatorEntry, 'ghId'>) }))),
        (e) => onErr?.(err(e)),
      );
    },
    async addCreator(u) {
      await setDoc(doc(fs, 'creators', u.id), { login: u.login, name: u.name, avatarUrl: u.avatarUrl, addedAt: Date.now() });
    },
    async removeCreator(ghId) {
      await deleteDoc(doc(fs, 'creators', ghId));
    },

    subscribeBoards(user, cb, onErr) {
      const q = query(collection(fs, 'boards'), where('memberIds', 'array-contains', user.ghId));
      return onSnapshot(
        q,
        (s) => cb(s.docs.map((d) => ({ ...(d.data() as Board), id: d.id }))),
        (e) => onErr?.(err(e)),
      );
    },
    subscribeBoard(boardId, cb, onErr) {
      return onSnapshot(
        boardRef(boardId),
        (s) => cb(s.exists() ? { ...(s.data() as Board), id: s.id } : null),
        (e) => onErr?.(err(e)),
      );
    },
    async createBoard(user, input) {
      const ref = doc(collection(fs, 'boards'));
      const now = Date.now();
      const board: Omit<Board, 'id'> = {
        ...input.draft,
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
      await setDoc(ref, clean(board));
      for (let i = 0; i < input.issues.length; i += 450) {
        const batch = writeBatch(fs);
        for (const issue of input.issues.slice(i, i + 450)) {
          const { id, ...data } = issue;
          batch.set(issueRef(ref.id, id), clean(data));
        }
        await batch.commit();
      }
      return ref.id;
    },
    async updateBoard(boardId, patch) {
      const { id: _omit, ...rest } = patch;
      void _omit;
      await updateDoc(boardRef(boardId), clean({ ...rest, updatedAt: Date.now() }));
    },
    async deleteBoard(boardId) {
      const issues = await getDocs(issuesCol(boardId));
      for (const d of issues.docs) {
        const [c, h] = await Promise.all([getDocs(commentsCol(boardId, d.id)), getDocs(historyCol(boardId, d.id))]);
        await deleteRefs([...c.docs.map((x) => x.ref), ...h.docs.map((x) => x.ref), d.ref]);
      }
      await deleteDoc(boardRef(boardId));
    },

    subscribeIssues(boardId, cb, onErr) {
      return onSnapshot(
        issuesCol(boardId),
        (s) => cb(s.docs.map((d) => ({ ...(d.data() as Issue), id: d.id }))),
        (e) => onErr?.(err(e)),
      );
    },
    async createIssue(boardId, user, draft) {
      const ref = doc(issuesCol(boardId));
      const now = Date.now();
      const created = await runTransaction(fs, async (tx) => {
        const bs = await tx.get(boardRef(boardId));
        if (!bs.exists()) throw new Error('Доска не найдена');
        const number = ((bs.data() as Board).issueCounter ?? 0) + 1;
        const issue: Omit<Issue, 'id'> = {
          ...draft,
          number,
          createdAt: now,
          updatedAt: now,
          createdBy: user.ghId,
          resolvedAt: draft.resolvedAt ?? null,
        };
        tx.update(boardRef(boardId), { issueCounter: number, updatedAt: now });
        tx.set(ref, clean(issue));
        return issue;
      });
      return { ...created, id: ref.id };
    },
    async updateIssue(boardId, issueId, patch, user, changes) {
      const { id: _omit, ...rest } = patch;
      void _omit;
      const batch = writeBatch(fs);
      batch.update(issueRef(boardId, issueId), clean({ ...rest, updatedAt: Date.now() }));
      if (changes.length) {
        batch.set(doc(historyCol(boardId, issueId)), clean({ actorId: user.ghId, at: Date.now(), changes }));
      }
      await batch.commit();
    },
    async deleteIssue(boardId, issueId) {
      const [c, h] = await Promise.all([getDocs(commentsCol(boardId, issueId)), getDocs(historyCol(boardId, issueId))]);
      const refs = [...c.docs.map((x) => x.ref), ...h.docs.map((x) => x.ref)];
      // Сначала удаляем задачу вместе с первыми комментариями одним батчем:
      // правила разрешают удалять комментарии уже удалённой задачи.
      const batch = writeBatch(fs);
      refs.slice(0, 400).forEach((r) => batch.delete(r));
      batch.delete(issueRef(boardId, issueId));
      await batch.commit();
      if (refs.length > 400) await deleteRefs(refs.slice(400));
    },

    subscribeComments(boardId, issueId, cb, onErr) {
      return onSnapshot(
        query(commentsCol(boardId, issueId), orderBy('createdAt', 'asc')),
        (s) => cb(s.docs.map((d) => ({ ...(d.data() as Comment), id: d.id }))),
        (e) => onErr?.(err(e)),
      );
    },
    async addComment(boardId, issueId, user, body) {
      await setDoc(doc(commentsCol(boardId, issueId), uid(20)), { authorId: user.ghId, body, createdAt: Date.now(), editedAt: null });
    },
    async updateComment(boardId, issueId, commentId, body) {
      await updateDoc(doc(commentsCol(boardId, issueId), commentId), { body, editedAt: Date.now() });
    },
    async deleteComment(boardId, issueId, commentId) {
      await deleteDoc(doc(commentsCol(boardId, issueId), commentId));
    },

    subscribeHistory(boardId, issueId, cb, onErr) {
      return onSnapshot(
        query(historyCol(boardId, issueId), orderBy('at', 'asc')),
        (s) => cb(s.docs.map((d) => ({ ...(d.data() as HistoryEntry), id: d.id }))),
        (e) => onErr?.(err(e)),
      );
    },
  };
}
