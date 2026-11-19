import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GithubAuthProvider,
  browserLocalPersistence,
  getAdditionalUserInfo,
  getRedirectResult,
  initializeAuth,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth';
import {
  FieldPath,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import type { AppUser, Board, Issue } from '../types';
import type { FirebaseWebConfig } from '../config';
import { config } from '../config';
import { lookupGitHubUserById } from '../lib/github';
import { normalizeBoard, normalizeComment, normalizeHistoryEntry, normalizeIssue } from '../lib/normalize';
import { uid } from '../lib/utils';
import { t } from '../i18n';
import type { CreatorEntry, Store } from './types';

// ---------------------------------------------------------------------------
// Cached GitHub profile (login, name, avatar) — public data, refreshed daily
// ---------------------------------------------------------------------------

const PROFILE_PREFIX = 'kb-gh-profile-';
const PROFILE_TTL = 24 * 3600_000;

interface CachedProfile {
  login: string;
  name: string;
  avatarUrl: string;
  at: number;
}

function readProfile(ghId: string): CachedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_PREFIX + ghId);
    const p = raw ? (JSON.parse(raw) as Partial<CachedProfile>) : null;
    return p && typeof p.login === 'string' && p.login ? { login: p.login, name: String(p.name ?? p.login), avatarUrl: String(p.avatarUrl ?? ''), at: Number(p.at) || 0 } : null;
  } catch {
    return null;
  }
}

function writeProfile(ghId: string, p: Omit<CachedProfile, 'at'>) {
  try {
    localStorage.setItem(PROFILE_PREFIX + ghId, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/** Settings of the device, not of the user: they stay after signing out (as does the demo mode's own data, kb-local-*). */
const DEVICE_KEYS = new Set(['kb-lang', 'kb-theme', 'kb-design']);

/** Removes what this app keeps in the browser for the signed-in user (profiles, filters, per-board view settings). */
function clearLocalUserData() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      for (const k of Object.keys(storage)) {
        if (k.startsWith('kb-') && !k.startsWith('kb-local-') && !DEVICE_KEYS.has(k)) storage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Earlier versions kept an offline copy of the boards in IndexedDB, which stayed on the device
 * after signing out. The app now caches in memory only; this removes the old copy.
 */
function deleteLegacyCache(projectId: string) {
  try {
    const idb = window.indexedDB;
    if (!idb) return;
    const prefix = `firestore/[DEFAULT]/${projectId}/`;
    const drop = (name: string) => {
      try {
        idb.deleteDatabase(name);
      } catch {
        /* ignore */
      }
    };
    if (typeof idb.databases === 'function') {
      idb.databases().then(
        (list) => list.forEach((d) => d.name?.startsWith(prefix) && drop(d.name)),
        () => drop(prefix + 'main'),
      );
    } else {
      drop(prefix + 'main');
    }
  } catch {
    /* ignore */
  }
}

function githubId(user: User): string | null {
  return user.providerData.find((p) => p.providerId === 'github.com')?.uid ?? null;
}

function saveProfileFrom(res: UserCredential) {
  const info = getAdditionalUserInfo(res);
  const ghId = githubId(res.user);
  if (ghId && info?.username) {
    const profile = info.profile as { name?: string; avatar_url?: string } | null;
    writeProfile(ghId, { login: info.username, name: profile?.name || info.username, avatarUrl: profile?.avatar_url || res.user.photoURL || '' });
  }
}

async function toAppUser(user: User): Promise<AppUser> {
  const ghId = githubId(user) ?? user.uid;
  let prof = readProfile(ghId);
  if (!prof || Date.now() - prof.at > PROFILE_TTL) {
    const gh = await lookupGitHubUserById(ghId);
    if (gh) {
      writeProfile(ghId, { login: gh.login, name: gh.name, avatarUrl: gh.avatarUrl });
      prof = readProfile(ghId);
    }
  }
  return {
    uid: user.uid,
    ghId,
    login: prof?.login ?? user.displayName ?? 'user',
    name: prof?.name || user.displayName || prof?.login || 'User',
    avatarUrl: prof?.avatarUrl || user.photoURL || '',
  };
}

function err(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return new Error(t('Access denied (permission-denied)'));
  return e instanceof Error ? e : new Error(String(e));
}

function authError(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === 'auth/popup-blocked') return new Error(t('The sign-in window was blocked. Allow pop-ups for this site and try again.'));
  if (code === 'auth/unauthorized-domain') {
    return new Error(t('Domain {host} is not listed in Firebase → Authentication → Settings → Authorized domains', { host: location.hostname }));
  }
  if (code === 'auth/operation-not-allowed') return new Error(t('GitHub sign-in is not enabled in Firebase → Authentication → Sign-in method'));
  return err(e);
}

/** Firestore rejects undefined values — strip them. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

async function initAppCheck(app: FirebaseApp, siteKey: string) {
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
}

const REDIRECT_FLAG = 'kb-auth-redirect';
const BATCH = 400;

export async function createFirebaseStore(cfg: FirebaseWebConfig): Promise<Store> {
  const app = initializeApp(cfg);
  if (config.appCheckSiteKey) await initAppCheck(app, config.appCheckSiteKey);
  const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  // Memory cache only: nothing from the boards is stored on the device.
  const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  deleteLegacyCache(cfg.projectId);

  // A redirect sign-in is only used where popups are not supported; report its errors on return.
  let redirectPending = false;
  try {
    redirectPending = sessionStorage.getItem(REDIRECT_FLAG) === '1';
    sessionStorage.removeItem(REDIRECT_FLAG);
  } catch {
    /* ignore */
  }
  const redirectError: Promise<string | null> = redirectPending
    ? getRedirectResult(auth).then(
        (res) => {
          if (res) saveProfileFrom(res);
          return null;
        },
        (e) => authError(e).message,
      )
    : Promise.resolve(null);

  const boardRef = (id: string) => doc(fs, 'boards', id);
  const issuesCol = (boardId: string) => collection(fs, 'boards', boardId, 'issues');
  const issueRef = (boardId: string, issueId: string) => doc(fs, 'boards', boardId, 'issues', issueId);
  const commentsCol = (b: string, i: string) => collection(fs, 'boards', b, 'issues', i, 'comments');
  const historyCol = (b: string, i: string) => collection(fs, 'boards', b, 'issues', i, 'history');

  async function deleteRefs(refs: DocumentReference[]) {
    for (let i = 0; i < refs.length; i += BATCH) {
      const batch = writeBatch(fs);
      refs.slice(i, i + BATCH).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }

  async function deleteBoard(boardId: string) {
    const issues = await getDocs(issuesCol(boardId));
    for (const d of issues.docs) {
      const [c, h] = await Promise.all([getDocs(commentsCol(boardId, d.id)), getDocs(historyCol(boardId, d.id))]);
      await deleteRefs([...c.docs.map((x) => x.ref), ...h.docs.map((x) => x.ref), d.ref]);
    }
    await deleteDoc(boardRef(boardId));
  }

  const updateIssues: Store['updateIssues'] = async (boardId, user, updates) => {
    // A batch holds up to 500 writes, and the rules may look up at most 20 documents per request:
    // every history entry checks its own issue, so one batch carries at most 10 of them.
    let batch = writeBatch(fs);
    let writes = 0;
    let entries = 0;
    for (const u of updates) {
      const withHistory = u.changes.length > 0;
      if (writes + 2 > 450 || (withHistory && entries >= 10)) {
        await batch.commit();
        batch = writeBatch(fs);
        writes = 0;
        entries = 0;
      }
      const { id: _omit, ...rest } = u.patch;
      void _omit;
      const now = Date.now();
      batch.update(issueRef(boardId, u.id), clean({ ...rest, updatedAt: now }));
      writes++;
      if (withHistory) {
        batch.set(doc(historyCol(boardId, u.id)), clean({ actorId: user.ghId, at: now, changes: u.changes }));
        writes++;
        entries++;
      }
    }
    if (writes) await batch.commit();
  };

  const issueData = (issue: Issue) => {
    const { id: _id, ...data } = issue;
    void _id;
    return clean(data);
  };

  return {
    mode: 'firebase',

    onAuth(cb) {
      // toAppUser is async: ignore results that arrive after a newer auth state.
      let seq = 0;
      return onAuthStateChanged(auth, (u) => {
        const my = ++seq;
        if (!u) return cb(null);
        toAppUser(u).then(
          (au) => my === seq && cb(au),
          () => my === seq && cb(null),
        );
      });
    },

    async signIn() {
      const provider = new GithubAuthProvider();
      provider.setCustomParameters({ allow_signup: 'true' });
      try {
        saveProfileFrom(await signInWithPopup(auth, provider));
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        // Some embedded browsers have no popups at all; the redirect flow is the only option there.
        // (A blocked popup is reported instead: on GitHub Pages the redirect flow fails in browsers
        // that partition third-party storage, because the auth domain differs from the site.)
        if (code === 'auth/operation-not-supported-in-this-environment') {
          try {
            sessionStorage.setItem(REDIRECT_FLAG, '1');
          } catch {
            /* ignore */
          }
          await signInWithRedirect(auth, provider);
          return;
        }
        throw authError(e);
      }
    },

    consumeAuthError() {
      return redirectError;
    },

    async signOut() {
      await fbSignOut(auth);
      clearLocalUserData();
      // Start from a clean page so nothing read for this user stays in memory.
      location.reload();
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
        (s) =>
          cb(
            s.docs.map((d) => {
              const x = d.data();
              return { ghId: d.id, login: String(x.login ?? ''), name: String(x.name ?? ''), avatarUrl: String(x.avatarUrl ?? ''), addedAt: Number(x.addedAt) || 0 } satisfies CreatorEntry;
            }),
          ),
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
        (s) => cb(s.docs.map((d) => normalizeBoard(d.data(), d.id))),
        (e) => onErr?.(err(e)),
      );
    },
    subscribeBoard(boardId, cb, onErr) {
      return onSnapshot(
        boardRef(boardId),
        (s) => cb(s.exists() ? normalizeBoard(s.data(), s.id) : null),
        (e) => onErr?.(err(e)),
      );
    },
    async countIssues(boardId) {
      try {
        return (await getCountFromServer(issuesCol(boardId))).data().count;
      } catch {
        return null;
      }
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
      // The board and the first issues are written atomically; if a later chunk fails,
      // the half-created board is removed again.
      const first = writeBatch(fs);
      first.set(ref, clean(board));
      for (const issue of input.issues.slice(0, BATCH)) first.set(issueRef(ref.id, issue.id), issueData(issue));
      try {
        await first.commit();
      } catch (e) {
        throw err(e);
      }
      try {
        for (let i = BATCH; i < input.issues.length; i += BATCH) {
          const batch = writeBatch(fs);
          for (const issue of input.issues.slice(i, i + BATCH)) batch.set(issueRef(ref.id, issue.id), issueData(issue));
          await batch.commit();
        }
      } catch (e) {
        await deleteBoard(ref.id).catch(() => {});
        throw err(e);
      }
      return ref.id;
    },
    async updateBoard(boardId, patch) {
      const { id: _omit, ...rest } = patch;
      void _omit;
      await updateDoc(boardRef(boardId), clean({ ...rest, updatedAt: Date.now() }));
    },
    // Membership changes touch single map entries, so concurrent edits by two admins do not overwrite each other.
    async addMember(boardId, u, role) {
      await updateDoc(
        boardRef(boardId),
        new FieldPath('members', u.id),
        role,
        'memberIds',
        arrayUnion(u.id),
        new FieldPath('memberInfo', u.id),
        { login: u.login, name: u.name, avatarUrl: u.avatarUrl },
        'updatedAt',
        Date.now(),
      );
    },
    async setMemberRole(boardId, ghId, role) {
      await updateDoc(boardRef(boardId), new FieldPath('members', ghId), role, 'updatedAt', Date.now());
    },
    async removeMember(boardId, ghId, forget = []) {
      const info = [...new Set([ghId, ...forget])].flatMap((id) => [new FieldPath('memberInfo', id), deleteField()]);
      await updateDoc(boardRef(boardId), new FieldPath('members', ghId), deleteField(), 'memberIds', arrayRemove(ghId), ...info, 'updatedAt', Date.now());
    },
    async transferOwnership(boardId, fromId, toId) {
      await updateDoc(boardRef(boardId), 'ownerId', toId, new FieldPath('members', toId), 'owner', new FieldPath('members', fromId), 'admin', 'updatedAt', Date.now());
    },
    deleteBoard,

    subscribeIssues(boardId, cb, onErr) {
      // Only changed documents are normalized again; unchanged issues keep their objects, so
      // memoized cards do not re-render when one issue of the board changes.
      const cache = new Map<string, Issue>();
      return onSnapshot(
        issuesCol(boardId),
        (s) => {
          for (const ch of s.docChanges()) {
            if (ch.type === 'removed') cache.delete(ch.doc.id);
            else cache.set(ch.doc.id, normalizeIssue(ch.doc.data(), ch.doc.id));
          }
          cb(s.docs.map((d) => cache.get(d.id) ?? normalizeIssue(d.data(), d.id)));
        },
        (e) => onErr?.(err(e)),
      );
    },
    async createIssue(boardId, user, draft) {
      const ref = doc(issuesCol(boardId));
      const now = Date.now();
      const created = await runTransaction(fs, async (tx) => {
        const bs = await tx.get(boardRef(boardId));
        if (!bs.exists()) throw new Error(t('Board not found'));
        const number = normalizeBoard(bs.data(), bs.id).issueCounter + 1;
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
      }).catch((e) => {
        throw err(e);
      });
      return { ...created, id: ref.id };
    },
    updateIssue: (boardId, issueId, patch, user, changes) => updateIssues(boardId, user, [{ id: issueId, patch, changes }]),
    updateIssues,
    async deleteIssue(boardId, issueId) {
      const [c, h] = await Promise.all([getDocs(commentsCol(boardId, issueId)), getDocs(historyCol(boardId, issueId))]);
      const refs = [...c.docs.map((x) => x.ref), ...h.docs.map((x) => x.ref)];
      // Delete the issue together with the first comments in one batch:
      // the rules allow deleting comments of an issue that no longer exists.
      const batch = writeBatch(fs);
      refs.slice(0, BATCH).forEach((r) => batch.delete(r));
      batch.delete(issueRef(boardId, issueId));
      await batch.commit();
      if (refs.length > BATCH) await deleteRefs(refs.slice(BATCH));
    },

    subscribeComments(boardId, issueId, cb, onErr) {
      return onSnapshot(
        query(commentsCol(boardId, issueId), orderBy('createdAt', 'asc')),
        (s) => cb(s.docs.map((d) => normalizeComment(d.data(), d.id))),
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
        (s) => cb(s.docs.map((d) => normalizeHistoryEntry(d.data(), d.id))),
        (e) => onErr?.(err(e)),
      );
    },
  };
}
