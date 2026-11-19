import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Board, Issue, IssueDraft } from '../types';
import { useApp } from '../app-context';
import { navigate, setQueryParam, type Route } from '../router';
import { permsFor, roleName, cls } from '../lib/utils';
import { EMPTY_FILTERS, diffIssue, statusSideEffects, type Filters } from '../lib/issues';
import { BoardContext, type BoardCtx } from './board-context';
import { EmptyState, Spinner } from './ui';
import { Icon } from './Icons';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { ReleasesView } from './ReleasesView';
import { SettingsView } from './SettingsView';
import { MembersView } from './MembersView';
import { IssueDialog } from './IssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';

const VIEWS = [
  { id: 'board', name: 'Доска', icon: 'board' },
  { id: 'list', name: 'Список задач', icon: 'list' },
  { id: 'releases', name: 'Релизы', icon: 'release' },
  { id: 'members', name: 'Участники', icon: 'users' },
  { id: 'settings', name: 'Настройки', icon: 'settings' },
];

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

  const perms = permsFor(board, user.ghId);
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
      if (!board) return;
      const full = { ...patch, ...(patch.status && patch.status !== issue.status ? statusSideEffects(board, issue, patch.status) : {}) };
      const changes = diffIssue(board, issue, full, issues ?? []);
      // оптимистичное обновление
      setIssues((list) => list?.map((i) => (i.id === issue.id ? { ...i, ...full, updatedAt: Date.now() } : i)) ?? list);
      await run(store.updateIssue(board.id, issue.id, full, user, changes));
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

  const openIssue = useCallback((i: Issue) => setQueryParam('i', String(i.number)), []);
  const newIssue = useCallback((d?: Partial<IssueDraft>) => setCreating(d ?? {}), []);

  const openNumber = route.query.get('i');
  const openedIssue = openNumber ? (issues ?? []).find((i) => String(i.number) === openNumber) : undefined;

  // Горячие клавиши: C — создать задачу, / — поиск
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable=true]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key === 'c' || e.key === 'с') {
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

  if (error && !board) {
    return (
      <EmptyState icon="shield" title="Нет доступа к доске">
        <p className="muted">Доска не существует или вас не добавили в участники. Попросите администратора доски добавить @{user.login}.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          К списку досок
        </button>
      </EmptyState>
    );
  }
  if (board === undefined) return <Spinner label="Загрузка доски…" />;
  if (board === null || !canView) {
    return (
      <EmptyState icon="shield" title={board === null ? 'Доска не найдена' : 'Нет доступа к доске'}>
        <p className="muted">{board === null ? 'Возможно, её удалили.' : `Попросите администратора добавить @${user.login}.`}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          К списку досок
        </button>
      </EmptyState>
    );
  }

  const ctx: BoardCtx = {
    board,
    issues: issues ?? [],
    byId,
    perms,
    filters,
    setFilters,
    openIssue,
    newIssue,
    updateIssue,
    updateBoard,
  };

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
                <span>{v.name}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-foot muted small">
            Горячие клавиши: <kbd>C</kbd> — создать задачу, <kbd>/</kbd> — поиск
          </div>
        </aside>
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />
        <main className="board-main">
          <div className="breadcrumbs">
            <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Меню доски">
              <Icon name="menu" size={18} />
            </button>
            <a href="#/">Доски</a>
            <span>/</span>
            <a href={`#/b/${board.id}`}>{board.name}</a>
            <span>/</span>
            <span>{current.name}</span>
          </div>
          {issues === null ? (
            <Spinner label="Загрузка задач…" />
          ) : current.id === 'board' ? (
            <KanbanView />
          ) : current.id === 'list' ? (
            <ListView />
          ) : current.id === 'releases' ? (
            <ReleasesView />
          ) : current.id === 'members' ? (
            <MembersView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>
      {openNumber && issues && (openedIssue ? <IssueDialog issue={openedIssue} onClose={() => setQueryParam('i', null)} /> : <MissingIssue onClose={() => setQueryParam('i', null)} />)}
      {creating && <CreateIssueDialog defaults={creating} onClose={() => setCreating(null)} />}
    </BoardContext.Provider>
  );
}

function MissingIssue({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 50);
    return () => clearTimeout(t);
  }, [onClose]);
  return null;
}
