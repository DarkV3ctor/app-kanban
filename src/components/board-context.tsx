import { createContext, useContext } from 'react';
import type { Board, Issue, IssueDraft } from '../types';
import type { Perms } from '../lib/utils';
import type { Filters } from '../lib/issues';

export interface BoardCtx {
  board: Board;
  issues: Issue[];
  byId: Map<string, Issue>;
  perms: Perms;
  filters: Filters;
  setFilters: (f: Filters) => void;
  openIssue: (issue: Issue) => void;
  newIssue: (defaults?: Partial<IssueDraft>) => void;
  /** Resolves to whether the change was saved (errors are shown as a toast). */
  updateIssue: (issue: Issue, patch: Partial<Issue>) => Promise<boolean>;
  updateBoard: (patch: Partial<Board>) => Promise<void>;
  /** Whether you may delete the issue: admins any, editors the ones they created. */
  canDelete: (issue: Issue) => boolean;
  /**
   * Asks, then deletes the issue (with its comments and history) and drops references to it from
   * other issues. `onConfirmed` runs once the deletion is confirmed, before it is done.
   * Resolves to whether it was confirmed.
   */
  deleteIssue: (issue: Issue, onConfirmed?: () => void) => Promise<boolean>;
}

export const BoardContext = createContext<BoardCtx | null>(null);

export function useBoard(): BoardCtx {
  const c = useContext(BoardContext);
  if (!c) throw new Error('BoardContext missing');
  return c;
}
