import type { AppUser, Board, BoardSetup, Comment, HistoryChange, HistoryEntry, Issue, IssueDraft, Role } from '../types';
import type { GitHubUser } from '../lib/github';

export type Unsub = () => void;
export type ErrCb = (e: Error) => void;

export interface CreatorEntry {
  ghId: string;
  login: string;
  name: string;
  avatarUrl: string;
  addedAt: number;
}

export interface NewBoardInput {
  draft: BoardSetup;
  name: string;
  key: string;
  description: string;
  /** Issues to create together with the board (already numbered, with ids). */
  issues: Issue[];
}

export interface Store {
  mode: 'firebase' | 'local';

  onAuth(cb: (u: AppUser | null) => void): Unsub;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Error from a redirect sign-in that finished while the page was reloading (null if none). */
  consumeAuthError(): Promise<string | null>;

  canCreateBoards(user: AppUser): Promise<boolean>;
  subscribeCreators(cb: (list: CreatorEntry[]) => void, onErr?: ErrCb): Unsub;
  addCreator(u: GitHubUser): Promise<void>;
  removeCreator(ghId: string): Promise<void>;

  subscribeBoards(user: AppUser, cb: (boards: Board[]) => void, onErr?: ErrCb): Unsub;
  subscribeBoard(boardId: string, cb: (b: Board | null) => void, onErr?: ErrCb): Unsub;
  /** Number of issues on the board, or null if it cannot be counted right now. */
  countIssues(boardId: string): Promise<number | null>;
  createBoard(user: AppUser, input: NewBoardInput): Promise<string>;
  updateBoard(boardId: string, patch: Partial<Board>): Promise<void>;
  addMember(boardId: string, u: GitHubUser, role: Role): Promise<void>;
  setMemberRole(boardId: string, ghId: string, role: Role): Promise<void>;
  /** Removes a member (also used to leave a board). */
  removeMember(boardId: string, ghId: string): Promise<void>;
  /** The new owner must already be a member; the previous owner becomes an admin. */
  transferOwnership(boardId: string, fromId: string, toId: string): Promise<void>;
  deleteBoard(boardId: string): Promise<void>;

  subscribeIssues(boardId: string, cb: (issues: Issue[]) => void, onErr?: ErrCb): Unsub;
  createIssue(boardId: string, user: AppUser, draft: IssueDraft): Promise<Issue>;
  updateIssue(boardId: string, issueId: string, patch: Partial<Issue>, user: AppUser, changes: HistoryChange[]): Promise<void>;
  deleteIssue(boardId: string, issueId: string): Promise<void>;

  subscribeComments(boardId: string, issueId: string, cb: (c: Comment[]) => void, onErr?: ErrCb): Unsub;
  addComment(boardId: string, issueId: string, user: AppUser, body: string): Promise<void>;
  updateComment(boardId: string, issueId: string, commentId: string, body: string): Promise<void>;
  deleteComment(boardId: string, issueId: string, commentId: string): Promise<void>;

  subscribeHistory(boardId: string, issueId: string, cb: (h: HistoryEntry[]) => void, onErr?: ErrCb): Unsub;
}
