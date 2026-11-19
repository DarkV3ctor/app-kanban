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
  updateIssue: (issue: Issue, patch: Partial<Issue>) => Promise<void>;
  updateBoard: (patch: Partial<Board>) => Promise<void>;
}

export const BoardContext = createContext<BoardCtx | null>(null);

export function useBoard(): BoardCtx {
  const c = useContext(BoardContext);
  if (!c) throw new Error('BoardContext missing');
  return c;
}
