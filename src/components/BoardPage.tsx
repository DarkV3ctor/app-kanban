import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
import { CalendarView } from './CalendarView';
import { ReleasesView } from './ReleasesView';
import { ProgressView } from './ProgressView';
import { SettingsView } from './SettingsView';
import { MembersView } from './MembersView';
import { IssueDialog } from './IssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { SidebarResizer, isNarrow, useSidebarPrefs } from './SidebarResizer';

const VIEWS = [
  { id: 'board', name: tk('Board'), icon: 'board' },
  { id: 'list', name: tk('Issue list'), icon: 'list' },
  { id: 'calendar', name: tk('Calendar'), icon: 'calendar' },
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
  const { store, user, toast, run, confirm } = useApp();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<Filters>(() => loadFilters(boardId));
  const [creating, setCreating] = useState<Partial<IssueDraft> | null>(null);
  // The menu is a drawer on narrow screens (sidebarOpen) and a column that can be hidden or
  // resized on wide ones (sidebarHidden / sidebarWidth).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { width: sidebarWidth, setWidth: setSidebarWidth, hidden: sidebarHidden, setHidden: setSidebarHidden } = useSidebarPrefs();
  const layoutRef = useRef<HTMLDivElement>(null);
  const showMenuRef = useRef<HTMLButtonElement>(null);
  const hideMenuRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<RefObject<HTMLButtonElement | null> | null>(null);
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

  const canDelete = useCallback((i: Issue) => perms.admin || (perms.edit && i.createdBy === user.ghId), [perms, user.ghId]);

  const deleteIssue = useCallback(
    async (issue: Issue, onConfirmed?: () => void) => {
      if (!board) return false;
      const key = `${board.key}-${issue.number}`;
      const ok = await confirm({
        title: t('Delete {key}?', { key }),
        text: t('The issue, its comments and history will be deleted permanently.'),
        confirmText: t('Delete'),
        danger: true,
      });
      if (!ok) return false;
      onConfirmed?.();
      // Remove references to this issue from other issues.
      const refs = (issues ?? []).filter((i) => i.id !== issue.id && (i.epicId === issue.id || i.links?.some((l) => l.issueId === issue.id)));
      await run(async () => {
        await store.updateIssues(
          board.id,
          user,
          refs.map((r) => ({ id: r.id, patch: { epicId: r.epicId === issue.id ? null : r.epicId, links: (r.links ?? []).filter((l) => l.issueId !== issue.id) }, changes: [] })),
        );
        await store.deleteIssue(board.id, issue.id);
      }, t('{key} deleted', { key }));
      return true;
    },
    [board, issues, confirm, run, store, user],
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
    () => (board ? { board, issues: issues ?? NO_ISSUES, byId, perms, filters, setFilters, openIssue, newIssue, updateIssue, updateBoard, canDelete, deleteIssue } : null),
    [board, issues, byId, perms, filters, setFilters, openIssue, newIssue, updateIssue, updateBoard, canDelete, deleteIssue],
  );

  const setMenu = useCallback(
    (show: boolean) => {
      // Focus inside the part that disappears would be lost: move it to the button that brings it back.
      const active = document.activeElement;
      if (active?.closest(show ? '.sidebar-toggle' : '.sidebar, .sidebar-resizer')) focusNext.current = show ? hideMenuRef : showMenuRef;
      if (isNarrow()) setSidebarOpen(show);
      else setSidebarHidden(!show);
    },
    [setSidebarHidden],
  );
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    target?.current?.focus();
  }, [sidebarOpen, sidebarHidden]);

  // Keyboard shortcuts: C — create issue, / — search, [ — show / hide the menu
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
      } else if (e.key === '[' || (e.code === 'BracketLeft' && !e.shiftKey)) {
        // Also by key position, so it works in the Ukrainian layout (where this key is "х").
        e.preventDefault();
        setMenu(isNarrow() ? !sidebarOpen : sidebarHidden);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [perms.edit, setMenu, sidebarOpen, sidebarHidden]);

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
      <div
        ref={layoutRef}
        className={cls('board-layout', sidebarOpen && 'sidebar-open', sidebarHidden && 'sidebar-hidden')}
        style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` }}
      >
        <aside className="sidebar" id="board-sidebar">
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
            <button ref={hideMenuRef} className="icon-btn sidebar-hide" onClick={() => setMenu(false)} aria-label={t('Hide menu')} title={t('Hide menu')}>
              <Icon name="sidebarHide" size={18} />
            </button>
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
            {t('Shortcuts:')} <kbd>C</kbd> — {t('create issue')}, <kbd>/</kbd> — {t('search')}, <kbd>[</kbd> — {t('hide menu')}
          </div>
        </aside>
        <SidebarResizer layoutRef={layoutRef} width={sidebarWidth} onResize={setSidebarWidth} onHide={() => setMenu(false)} />
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />
        <main className="board-main">
          <div className="breadcrumbs">
            <button
              ref={showMenuRef}
              className="icon-btn sidebar-toggle"
              onClick={() => setMenu(true)}
              aria-label={t('Show menu')}
              aria-controls="board-sidebar"
              title={t('Show menu')}
            >
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
          ) : current.id === 'calendar' ? (
            <CalendarView />
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
