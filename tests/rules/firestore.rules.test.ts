// Security rules tests. Run with the Firestore emulator (needs Java 21+):
//   npm run test:rules
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
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
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const OWNER = '78609208'; // also the app admin listed in firestore.rules
const BOARD_ADMIN = '600';
const EDITOR = '200';
const COMMENTER = '300';
const VIEWER = '400';
const STRANGER = '500';
const CREATOR = '700';
const FORMER = '900'; // removed earlier; their memberInfo entry was left behind

const HOUR = 3600_000;
const info = (login: string) => ({ login, name: login, avatarUrl: '' });

let env: RulesTestEnvironment;

/** Firestore as a user signed in with GitHub (numeric GitHub ID). */
function as(ghId: string, provider = 'github.com'): Firestore {
  return env
    .authenticatedContext(`uid-${ghId}`, { firebase: { sign_in_provider: provider as 'github.com', identities: { 'github.com': [ghId] } } })
    .firestore() as unknown as Firestore;
}

function boardData(over: Record<string, unknown> = {}) {
  return {
    name: 'Test',
    key: 'TST',
    description: '',
    template: 'blank',
    icon: '📋',
    color: '#1D7AFC',
    ownerId: OWNER,
    members: { [OWNER]: 'owner', [BOARD_ADMIN]: 'admin', [EDITOR]: 'editor', [COMMENTER]: 'commenter', [VIEWER]: 'viewer' },
    memberIds: [OWNER, BOARD_ADMIN, EDITOR, COMMENTER, VIEWER],
    memberInfo: {},
    columns: [{ id: 'todo', name: 'To do', category: 'todo', wip: 0 }],
    issueTypes: [],
    labels: [],
    components: [],
    versions: [],
    issueCounter: 2,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

function issueData(over: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: 'Issue',
    description: '',
    type: 'task',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    reporterId: EDITOR,
    labels: [],
    components: [],
    fixVersionId: null,
    epicId: null,
    storyPoints: null,
    estimate: '',
    dueDate: null,
    checklist: [],
    links: [],
    rank: 1000,
    createdAt: 1,
    updatedAt: 1,
    resolvedAt: null,
    createdBy: EDITOR,
    ...over,
  };
}

const comment = (over: Record<string, unknown> = {}) => ({ authorId: COMMENTER, body: 'Hello', createdAt: Date.now(), editedAt: null, ...over });

/** Creates an issue the way the app does: next number + counter increment in one transaction. */
function createIssue(db: Firestore, id: string, createdBy: string, createdAt = Date.now()) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'boards/b1');
    const snap = await tx.get(ref);
    const number = (snap.data()?.issueCounter as number) + 1;
    tx.update(ref, { issueCounter: number, updatedAt: createdAt });
    tx.set(doc(db, `boards/b1/issues/${id}`), issueData({ number, createdBy, createdAt, updatedAt: createdAt }));
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kanban',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(
      doc(db, 'boards/b1'),
      boardData({ memberInfo: Object.fromEntries([OWNER, BOARD_ADMIN, EDITOR, COMMENTER, VIEWER, FORMER].map((id) => [id, info(`user${id}`)])) }),
    );
    await setDoc(doc(db, 'boards/b1/issues/i1'), issueData({ number: 1, createdBy: EDITOR }));
    await setDoc(doc(db, 'boards/b1/issues/i2'), issueData({ number: 2, createdBy: OWNER }));
    await setDoc(doc(db, 'boards/b1/issues/i1/comments/c1'), comment());
    await setDoc(doc(db, `creators/${CREATOR}`), { login: 'creator', name: 'Creator', avatarUrl: '', addedAt: 1 });
  });
});

describe('authentication', () => {
  test('signed-out users and other sign-in providers get nothing', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as unknown as Firestore, 'boards/b1')));
    await assertFails(getDoc(doc(as(VIEWER, 'password'), 'boards/b1')));
  });
});

describe('boards', () => {
  test('members can read the board, strangers cannot', async () => {
    await assertSucceeds(getDoc(doc(as(VIEWER), 'boards/b1')));
    await assertFails(getDoc(doc(as(STRANGER), 'boards/b1')));
  });

  test('the board list is limited to your own memberships', async () => {
    await assertSucceeds(getDocs(query(collection(as(VIEWER), 'boards'), where('memberIds', 'array-contains', VIEWER))));
    await assertFails(getDocs(query(collection(as(STRANGER), 'boards'), where('memberIds', 'array-contains', VIEWER))));
    await assertFails(getDocs(collection(as(VIEWER), 'boards')));
  });

  test('an app admin creates a board together with its sample issues in one batch', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, 'boards/new'), boardData({ members: { [OWNER]: 'owner' }, memberIds: [OWNER] }));
    batch.set(doc(db, 'boards/new/issues/a'), issueData({ number: 1, createdBy: OWNER }));
    batch.set(doc(db, 'boards/new/issues/b'), issueData({ number: 2, createdBy: OWNER }));
    await assertSucceeds(batch.commit());
  });

  test('a full import batch (board + 400 issues, as the client writes it) stays within the rules limits', async () => {
    const db = as(OWNER);
    const batch = writeBatch(db);
    batch.set(doc(db, 'boards/big'), boardData({ members: { [OWNER]: 'owner' }, memberIds: [OWNER], issueCounter: 400 }));
    for (let n = 1; n <= 400; n++) batch.set(doc(db, `boards/big/issues/i${n}`), issueData({ number: n, createdBy: OWNER }));
    await assertSucceeds(batch.commit());
  });

  test('pre-numbered issues must stay within the counter', async () => {
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, 'boards/b1/issues/imp'), issueData({ number: 2, createdBy: OWNER })));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/imp2'), issueData({ number: 3, createdBy: OWNER })));
  });

  test('only app admins and allowed creators can create boards', async () => {
    const own = (id: string) => boardData({ ownerId: id, members: { [id]: 'owner' }, memberIds: [id] });
    await assertFails(setDoc(doc(as(STRANGER), 'boards/x'), own(STRANGER)));
    await assertSucceeds(setDoc(doc(as(CREATOR), 'boards/y'), own(CREATOR)));
  });

  test('a new board starts with only its creator', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'boards/z'), boardData()));
    const solo = { members: { [OWNER]: 'owner' }, memberIds: [OWNER] };
    await assertFails(setDoc(doc(as(OWNER), 'boards/z'), boardData({ ...solo, memberInfo: { [OWNER]: info('me'), [EDITOR]: info('someone') } })));
    await assertSucceeds(setDoc(doc(as(OWNER), 'boards/z'), boardData({ ...solo, memberInfo: { [OWNER]: info('me') } })));
  });

  test('roles must be valid and the owner is the only "owner"', async () => {
    const db = as(BOARD_ADMIN);
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('members', EDITOR), 'owner'));
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('members', EDITOR), 'superuser'));
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('members', OWNER), 'admin'));
    await assertSucceeds(updateDoc(doc(db, 'boards/b1'), new FieldPath('members', EDITOR), 'viewer'));
  });

  test('admins cannot take over the board; the owner can transfer it', async () => {
    await assertFails(updateDoc(doc(as(BOARD_ADMIN), 'boards/b1'), 'ownerId', BOARD_ADMIN, new FieldPath('members', BOARD_ADMIN), 'owner', new FieldPath('members', OWNER), 'admin'));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'boards/b1'), 'ownerId', EDITOR, new FieldPath('members', EDITOR), 'owner', new FieldPath('members', OWNER), 'admin'));
  });

  test('ownership cannot go to a non-member', async () => {
    await assertFails(
      updateDoc(doc(as(OWNER), 'boards/b1'), 'ownerId', STRANGER, new FieldPath('members', STRANGER), 'owner', 'memberIds', arrayUnion(STRANGER), new FieldPath('members', OWNER), 'admin'),
    );
  });

  test('the issue counter never goes back', async () => {
    await assertFails(updateDoc(doc(as(BOARD_ADMIN), 'boards/b1'), { issueCounter: 0 }));
  });

  test('admins add and remove members with single-entry updates', async () => {
    const db = as(BOARD_ADMIN);
    await assertSucceeds(
      updateDoc(doc(db, 'boards/b1'), new FieldPath('members', '800'), 'viewer', 'memberIds', arrayUnion('800'), new FieldPath('memberInfo', '800'), { login: 'x', name: 'X', avatarUrl: '' }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'boards/b1'), new FieldPath('members', '800'), deleteField(), 'memberIds', arrayRemove('800'), new FieldPath('memberInfo', '800'), deleteField()),
    );
    // members and memberIds must stay in sync
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('members', '801'), 'viewer'));
  });

  test('members can leave, but cannot remove anyone else', async () => {
    await assertFails(updateDoc(doc(as(VIEWER), 'boards/b1'), new FieldPath('members', COMMENTER), deleteField(), 'memberIds', arrayRemove(COMMENTER)));
    await assertSucceeds(updateDoc(doc(as(VIEWER), 'boards/b1'), new FieldPath('members', VIEWER), deleteField(), 'memberIds', arrayRemove(VIEWER), 'updatedAt', 5));
    await assertFails(updateDoc(doc(as(OWNER), 'boards/b1'), new FieldPath('members', OWNER), deleteField(), 'memberIds', arrayRemove(OWNER)));
  });

  test('member names cannot be rewritten, only added and removed with the member', async () => {
    const db = as(BOARD_ADMIN);
    // Renaming an existing member (the owner included) is rejected, for admins and the owner alike.
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('memberInfo', OWNER), info('evil')));
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('memberInfo', EDITOR), info('evil')));
    await assertFails(updateDoc(doc(as(OWNER), 'boards/b1'), new FieldPath('memberInfo', EDITOR), info('evil')));
    // So is an entry for someone who is not being added in the same write.
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('memberInfo', '801'), info('x')));
    // A current member's entry stays while they are a member.
    await assertFails(updateDoc(doc(db, 'boards/b1'), new FieldPath('memberInfo', EDITOR), deleteField()));
    // Entries left behind by former members can be cleaned up.
    await assertSucceeds(updateDoc(doc(db, 'boards/b1'), new FieldPath('memberInfo', FORMER), deleteField()));
  });

  test('a leaving member may remove only their own name entry', async () => {
    const db = as(COMMENTER);
    const leave = (...extra: unknown[]) =>
      updateDoc(doc(db, 'boards/b1'), new FieldPath('members', COMMENTER), deleteField(), 'memberIds', arrayRemove(COMMENTER), ...extra);
    await assertFails(leave(new FieldPath('memberInfo', EDITOR), deleteField()));
    await assertFails(leave(new FieldPath('memberInfo', COMMENTER), info('renamed')));
    await assertSucceeds(leave(new FieldPath('memberInfo', COMMENTER), deleteField()));
  });

  test('editors can only bump the counter', async () => {
    await assertSucceeds(updateDoc(doc(as(EDITOR), 'boards/b1'), { issueCounter: 3, updatedAt: 2 }));
    await assertFails(updateDoc(doc(as(EDITOR), 'boards/b1'), { issueCounter: 5 }));
    await assertFails(updateDoc(doc(as(EDITOR), 'boards/b1'), { name: 'Mine' }));
  });

  test('malformed board fields are rejected', async () => {
    const db = as(BOARD_ADMIN);
    await assertFails(updateDoc(doc(db, 'boards/b1'), { color: 'url(https://example.com/x)' }));
    await assertFails(updateDoc(doc(db, 'boards/b1'), { columns: 'todo' }));
    await assertFails(updateDoc(doc(db, 'boards/b1'), { columns: [] }));
    await assertFails(updateDoc(doc(db, 'boards/b1'), { key: 'lower' }));
    await assertFails(updateDoc(doc(db, 'boards/b1'), { description: 42 }));
    await assertSucceeds(updateDoc(doc(db, 'boards/b1'), { color: '#22A06B', key: 'NEW1' }));
  });

  test('only the owner deletes the board', async () => {
    await assertFails(deleteDoc(doc(as(BOARD_ADMIN), 'boards/b1')));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'boards/b1')));
  });
});

describe('issues', () => {
  test('editors create issues with the next number in a transaction', async () => {
    await assertSucceeds(createIssue(as(EDITOR), 'n1', EDITOR));
  });

  test('an issue without the counter increment is rejected (no duplicate numbers)', async () => {
    const db = as(EDITOR);
    await assertFails(setDoc(doc(db, 'boards/b1/issues/dup'), issueData({ number: 2, createdAt: Date.now() })));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/skip'), issueData({ number: 3, createdAt: Date.now() })));
  });

  test('new issues cannot be back- or forward-dated (imports keep their dates)', async () => {
    await assertFails(createIssue(as(EDITOR), 'old', EDITOR, Date.now() - HOUR));
    await assertFails(createIssue(as(EDITOR), 'future', EDITOR, Date.now() + HOUR));
  });

  test('issues are attributed to their creator', async () => {
    await assertFails(createIssue(as(EDITOR), 'n2', OWNER));
  });

  test('commenters and viewers cannot create issues', async () => {
    await assertFails(createIssue(as(COMMENTER), 'n3', COMMENTER));
    await assertFails(createIssue(as(VIEWER), 'n4', VIEWER));
  });

  test('malformed issue fields are rejected', async () => {
    const db = as(EDITOR);
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { labels: 5 }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { description: { x: 1 } }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { priority: 'urgent' }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { checklist: 'x' }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { title: '' }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { title: 'x'.repeat(501) }));
  });

  test('editors update issues, but not the number, creator or creation time', async () => {
    const db = as(EDITOR);
    await assertSucceeds(updateDoc(doc(db, 'boards/b1/issues/i1'), { title: 'Renamed', labels: ['a'], storyPoints: 2.5, updatedAt: 3 }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { number: 7 }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { createdBy: OWNER }));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1'), { createdAt: 0 }));
    await assertFails(updateDoc(doc(as(COMMENTER), 'boards/b1/issues/i1'), { title: 'Nope' }));
  });

  test('editors delete only their own issues, admins any', async () => {
    await assertFails(deleteDoc(doc(as(EDITOR), 'boards/b1/issues/i2')));
    await assertSucceeds(deleteDoc(doc(as(EDITOR), 'boards/b1/issues/i1')));
    await assertSucceeds(deleteDoc(doc(as(BOARD_ADMIN), 'boards/b1/issues/i2')));
  });

  test('deleting an issue together with comments by others', async () => {
    const db = as(EDITOR);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'boards/b1/issues/i1/comments/c1'));
    batch.delete(doc(db, 'boards/b1/issues/i1'));
    await assertSucceeds(batch.commit());
  });

  test('members can count issues, strangers cannot', async () => {
    await assertSucceeds(getCountFromServer(collection(as(VIEWER), 'boards/b1/issues')));
    await assertFails(getCountFromServer(collection(as(STRANGER), 'boards/b1/issues')));
  });
});

describe('comments', () => {
  const path = 'boards/b1/issues/i1/comments';

  test('commenters add valid comments under their own name', async () => {
    const db = as(COMMENTER);
    await assertSucceeds(setDoc(doc(db, `${path}/c2`), comment()));
    await assertFails(setDoc(doc(db, `${path}/c3`), comment({ authorId: EDITOR })));
    await assertFails(setDoc(doc(db, `${path}/c4`), comment({ body: '' })));
    await assertFails(setDoc(doc(db, `${path}/c5`), comment({ body: 'x'.repeat(20001) })));
    await assertFails(setDoc(doc(db, `${path}/c6`), comment({ extra: true })));
    await assertFails(setDoc(doc(db, `${path}/c7`), comment({ editedAt: 5 })));
  });

  test('viewers cannot comment', async () => {
    await assertFails(setDoc(doc(as(VIEWER), `${path}/c8`), comment({ authorId: VIEWER })));
  });

  test('comments need an existing issue', async () => {
    await assertFails(setDoc(doc(as(COMMENTER), 'boards/b1/issues/missing/comments/c9'), comment()));
  });

  test('authors change only the text of their own comments', async () => {
    const db = as(COMMENTER);
    await assertSucceeds(updateDoc(doc(db, `${path}/c1`), { body: 'Edited', editedAt: Date.now() }));
    await assertFails(updateDoc(doc(db, `${path}/c1`), { body: { evil: true }, editedAt: Date.now() + 1 }));
    await assertFails(updateDoc(doc(db, `${path}/c1`), { body: 'x'.repeat(20001), editedAt: Date.now() + 1 }));
    await assertFails(updateDoc(doc(db, `${path}/c1`), { createdAt: 99 }));
    await assertFails(updateDoc(doc(db, `${path}/c1`), { body: 'No mark' }));
    await assertFails(updateDoc(doc(as(EDITOR), `${path}/c1`), { body: 'Not mine', editedAt: Date.now() }));
  });

  test('comments and edits cannot be back- or forward-dated', async () => {
    const db = as(COMMENTER);
    await assertFails(setDoc(doc(db, `${path}/old`), comment({ createdAt: Date.now() - HOUR })));
    await assertFails(setDoc(doc(db, `${path}/future`), comment({ createdAt: Date.now() + HOUR })));
    await assertFails(updateDoc(doc(db, `${path}/c1`), { body: 'Edited', editedAt: Date.now() - HOUR }));
  });

  test('authors and admins delete comments', async () => {
    await assertFails(deleteDoc(doc(as(EDITOR), `${path}/c1`)));
    await assertSucceeds(deleteDoc(doc(as(BOARD_ADMIN), `${path}/c1`)));
  });
});

describe('history', () => {
  const entry = (over: Record<string, unknown> = {}) => ({ actorId: EDITOR, at: Date.now(), changes: [{ field: 'title', from: 'a', to: 'b' }], ...over });

  test('history is written with the issue change', async () => {
    const db = as(EDITOR);
    const batch = writeBatch(db);
    batch.update(doc(db, 'boards/b1/issues/i1'), { title: 'b', updatedAt: 2 });
    batch.set(doc(db, 'boards/b1/issues/i1/history/h1'), entry());
    await assertSucceeds(batch.commit());
  });

  test('a batch of 10 issue updates with their history stays within the rules limits', async () => {
    // The client (updateIssues) puts at most 10 history entries into one batch: each checks its own issue.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      for (let n = 1; n <= 10; n++) await setDoc(doc(db, `boards/b1/issues/m${n}`), issueData({ number: 100 + n, createdBy: EDITOR }));
    });
    const db = as(EDITOR);
    const batch = writeBatch(db);
    for (let n = 1; n <= 10; n++) {
      batch.update(doc(db, `boards/b1/issues/m${n}`), { status: 'done', updatedAt: Date.now() });
      batch.set(doc(db, `boards/b1/issues/m${n}/history/h`), entry({ changes: [{ field: 'status', from: 'To do', to: 'Done' }] }));
    }
    await assertSucceeds(batch.commit());
  });

  test('history entries are validated and immutable', async () => {
    const db = as(EDITOR);
    await assertFails(setDoc(doc(db, 'boards/b1/issues/i1/history/h2'), entry({ actorId: OWNER })));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/i1/history/h3'), entry({ changes: [] })));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/i1/history/h4'), entry({ extra: 1 })));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/missing/history/h5'), entry()));
    await assertFails(setDoc(doc(db, 'boards/b1/issues/i1/history/h7'), entry({ at: Date.now() - HOUR })));
    await assertSucceeds(setDoc(doc(db, 'boards/b1/issues/i1/history/h6'), entry()));
    await assertFails(updateDoc(doc(db, 'boards/b1/issues/i1/history/h6'), { at: 3 }));
  });
});

describe('creators', () => {
  test('users can check only their own entry; app admins manage the list', async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), `creators/${STRANGER}`)));
    await assertFails(getDoc(doc(as(STRANGER), `creators/${CREATOR}`)));
    await assertFails(getDocs(collection(as(STRANGER), 'creators')));
    await assertFails(setDoc(doc(as(STRANGER), `creators/${STRANGER}`), { login: 's' }));
    await assertSucceeds(getDocs(collection(as(OWNER), 'creators')));
    await assertSucceeds(setDoc(doc(as(OWNER), `creators/${STRANGER}`), { login: 's', name: 'S', avatarUrl: '', addedAt: 1 }));
  });
});
