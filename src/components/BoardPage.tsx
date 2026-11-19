import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Board, Issue, IssueDraft } from '../types';
import { useApp } from '../app-context';
import { navigate, setQueryParam, type Route } from '../router';
import { permsFor, roleName, cls } from '../lib/utils';
import { t, tk } from '../i18n';
import { EMPTY_FILTERS, diffIssue, statusSideEffects, type Filters } from '../lib/issues';
import { BoardContext, type BoardCtx } from './board-context';
import { EmptyState, ErrorBoundary, ErrorPanel, Modal, Spinner } from './ui';
import { Icon } from './Icons';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { ReleasesView } from './ReleasesView';
import { ProgressView } from './ProgressView';
import { SettingsView } from './SettingsView';
import { MembersView } from './MembersView';
import { IssueDialog } from './IssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';

const VIEWS = [
  { id: 'board', name: tk('Board'), icon: 'board' },
  { id: 'list', name: tk('Issue list'), icon: 'list' },
  { id: 'progress', name: tk('Progress'), icon: 'chart' },
  { id: 'releases', name: tk('Releases'), icon: 'release' },
  { id: 'members', name: tk('Members'), icon: 'users' },
  { id: 'settings', name: tk('Settings'), icon: 'settings' },
];

const NO_ISSUES: Issue[] = [];

function loadFilters(boardId: string): Filters {
  try {
    const raw = sessionStorage.getItem('kb-filters-' + boardId);
    if (raw) return { ...EMPTY_FILTERS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return EMPTY_FILTERS;
}

export function BoardPage({ boardId, view, route }: { boardId: string; view: string; route: Route }) {
  const { store, user, toast, run } = useApp();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<Filters>(() => loadFilters(boardId));
  const [creating, setCreating] = useState<Partial<IssueDraft> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // An issue opened right after it was created may not have arrived in the snapshot yet.
  const [pendingIssue, setPendingIssue] = useState<Issue | null>(null);

  useEffect(
    () =>
      store.subscribeBoard(
        boardId,
        (b) => {
          setBoard(b);
          setError(null);
        },
        (e) => setError(e.message),
      ),
    [store, boardId],
  );

  const perms = useMemo(() => permsFor(board, user.ghId), [board, user.ghId]);
  const canView = perms.view;

  useEffect(() => {
    if (!canView) return;
    return store.subscribeIssues(boardId, setIssues, (e) => toast(e.message, 'error'));
  }, [store, boardId, canView, toast]);

  const setFilters = useCallback(
    (f: Filters) => {
      setFiltersState(f);
      try {
        sessionStorage.setItem('kb-filters-' + boardId, JSON.stringify(f));
      } catch {
        /* ignore */
      }
    },
    [boardId],
  );

  const byId = useMemo(() => new Map((issues ?? []).map((i) => [i.id, i])), [issues]);

  const updateIssue = useCallback(
    async (issue: Issue, patch: Partial<Issue>) => {
      if (!board) return false;
      const full = { ...patch, ...(patch.status && patch.status !== issue.status ? statusSideEffects(board, issue, patch.status) : {}) };
      const changes = diffIssue(board, issue, full, issues ?? []);
      // optimistic update
      setIssues((list) => list?.map((i) => (i.id === issue.id ? { ...i, ...full, updatedAt: Date.now() } : i)) ?? list);
      return (await run(store.updateIssue(board.id, issue.id, full, user, changes).then(() => true))) ?? false;
    },
    [board, issues, run, store, user],
  );

  const updateBoard = useCallback(
    async (patch: Partial<Board>) => {
      if (!board) return;
      setBoard((b) => (b ? { ...b, ...patch } : b));
      await run(store.updateBoard(board.id, patch));
    },
    [board, run, store],
  );

  const openIssue = useCallback((i: Issue) => {
    setPendingIssue(i);
    setQueryParam('i', String(i.number));
  }, []);
  const newIssue = useCallback((d?: Partial<IssueDraft>) => setCreating(d ?? {}), []);

  // Once the snapshot has the issue, the live copy is used (and a later deletion closes the dialog).
  useEffect(() => {
    if (pendingIssue && byId.has(pendingIssue.id)) setPendingIssue(null);
  }, [pendingIssue, byId]);

  const openNumber = route.query.get('i');
  const openedIssue = openNumber
    ? (issues ?? []).find((i) => String(i.number) === openNumber) ?? (pendingIssue && String(pendingIssue.number) === openNumber ? pendingIssue : undefined)
    : undefined;
  const closeIssue = useCallback(() => setQueryParam('i', null), []);

  // Stable while nothing in it changes, so the (memoized) views skip re-rendering when, for
  // example, an issue dialog opens or the sidebar toggles.
  const ctx = useMemo<BoardCtx | null>(
    () => (board ? { board, issues: issues ?? NO_ISSUES, byId, perms, filters, setFilters, openIssue, newIssue, updateIssue, updateBoard } : null),
    [board, issues, byId, perms, filters, setFilters, openIssue, newIssue, updateIssue, updateBoard],
  );

  // Keyboard shortcuts: C — create issue, / — search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable=true]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key === 'c' || e.key === '\u0441' /* Cyrillic layout */) {
        if (perms.edit) {
          e.preventDefault();
          setCreating({});
        }
      } else if (e.key === '/') {
        const s = document.querySelector<HTMLInputElement>('.filter-search input');
        if (s) {
          e.preventDefault();
          s.focus();
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [perms.edit]);

  // A failed listener does not recover (e.g. after being removed from the board), so the
  // last known copy of the board must not stay on screen.
  if (error) {
    return (
      <EmptyState icon="shield" title={t('No access to this board')}>
        <p className="muted">{t('The board does not exist or you are not a member. Ask a board admin to add @{login}.', { login: user.login })}</p>
        <p className="muted small">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          {t('Back to boards')}
        </button>
      </EmptyState>
    );
  }
  if (board === undefined) return <Spinner label={t('Loading board…')} />;
  if (board === null || !canView || !ctx) {
    return (
      <EmptyState icon="shield" title={board === null ? t('Board not found') : t('No access to this board')}>
        <p className="muted">{board === null ? t('It may have been deleted.') : t('Ask a board admin to add @{login}.', { login: user.login })}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          {t('Back to boards')}
        </button>
      </EmptyState>
    );
  }

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const myRole = board.ownerId === user.ghId ? 'owner' : board.members[user.ghId];

  return (
    <BoardContext.Provider value={ctx}>
      <div className={cls('board-layout', sidebarOpen && 'sidebar-open')}>
        <aside className="sidebar">
          <div className="sidebar-project" style={{ ['--board-color' as string]: board.color }}>
            <span className="board-icon">{board.icon}</span>
            <div className="sidebar-project-text">
              <div className="sidebar-project-name" title={board.name}>
                {board.name}
              </div>
              <div className="muted small">
                {board.key} · {roleName(myRole)}
              </div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {VIEWS.map((v) => (
              <a
                key={v.id}
                href={`#/b/${board.id}${v.id === 'board' ? '' : '/' + v.id}`}
                className={cls('sidebar-link', current.id === v.id && 'is-active')}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon name={v.icon} size={18} />
                <span>{t(v.name)}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-foot muted small">
            {t('Shortcuts:')} <kbd>C</kbd> — {t('create issue')}, <kbd>/</kbd> — {t('search')}
          </div>
        </aside>
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />
        <main className="board-main">
          <div className="breadcrumbs">
            <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label={t('Board menu')}>
              <Icon name="menu" size={18} />
            </button>
            <a href="#/">{t('Boards')}</a>
            <span>/</span>
            <a href={`#/b/${board.id}`}>{board.name}</a>
            <span>/</span>
            <span>{t(current.name)}</span>
          </div>
          {issues === null ? (
            <Spinner label={t('Loading issues…')} />
          ) : current.id === 'board' ? (
            <KanbanView />
          ) : current.id === 'list' ? (
            <ListView />
          ) : current.id === 'progress' ? (
            <ProgressView />
          ) : current.id === 'releases' ? (
            <ReleasesView />
          ) : current.id === 'members' ? (
            <MembersView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>
      {openNumber &&
        issues &&
        (openedIssue ? (
          <ErrorBoundary
            resetKey={openedIssue}
            fallback={(e) => (
              <Modal title={`${board.key}-${openedIssue.number}`} onClose={closeIssue}>
                <ErrorPanel error={e} />
              </Modal>
            )}
          >
            {/* A new instance per issue: drafts and edit modes must not carry over to another issue. */}
            <IssueDialog key={openedIssue.id} issue={openedIssue} onClose={closeIssue} />
          </ErrorBoundary>
        ) : (
          <MissingIssue onClose={closeIssue} />
        ))}
      {creating && <CreateIssueDialog defaults={creating} onClose={() => setCreating(null)} />}
    </BoardContext.Provider>
  );
}

/** A link to an issue that is not (or no longer) on the board: drop the parameter after a moment. */
function MissingIssue({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 1000);
    return () => clearTimeout(t);
  }, [onClose]);
  return null;
}
