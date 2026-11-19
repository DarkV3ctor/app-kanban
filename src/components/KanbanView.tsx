import { memo, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import type { Issue, Priority } from '../types';
import { useApp } from '../app-context';
import { applyFilters, isEpic, newIssueDraft } from '../lib/issues';
import { PRIORITIES, cls, priorityName, rankBetween } from '../lib/utils';
import { fieldName } from '../lib/fields';
import { t } from '../i18n';
import { newColumnId } from '../templates';
import { useBoard } from './board-context';
import { FilterBar } from './FilterBar';
import { IssueCard } from './IssueCard';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { Avatar, Select, memberOf } from './ui';

type GroupBy = 'none' | 'assignee' | 'epic' | 'priority';

interface Lane {
  key: string;
  title: string;
  icon?: React.ReactNode;
  issues: Issue[];
}

function readPref<T extends string>(k: string, def: T): T {
  try {
    return (localStorage.getItem(k) as T) || def;
  } catch {
    return def;
  }
}
function writePref(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

// Memoized: re-renders only when the board context changes, not on every BoardPage render.
export const KanbanView = memo(function KanbanView() {
  const { user, store, run } = useApp();
  const { board, issues, byId, perms, filters, openIssue, newIssue, updateIssue, updateBoard } = useBoard();
  const [groupBy, setGroupBy] = useState<GroupBy>(() => readPref('kb-group-' + board.id, 'none'));
  const [showEpics, setShowEpics] = useState(() => readPref('kb-epics-' + board.id, 'show') === 'show');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    let list = applyFilters(board, issues, filters, user);
    if (!showEpics || groupBy === 'epic') list = list.filter((i) => !isEpic(board, i));
    return list;
  }, [board, issues, filters, user, showEpics, groupBy]);

  const lanes: Lane[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', title: '', issues: visible }];
    const map = new Map<string, Issue[]>();
    const push = (k: string, i: Issue) => {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    };
    for (const i of visible) {
      if (groupBy === 'assignee') push(i.assigneeId ?? 'none', i);
      else if (groupBy === 'epic') push(i.epicId && byId.has(i.epicId) ? i.epicId : 'none', i);
      else push(i.priority, i);
    }
    const res: Lane[] = [];
    if (groupBy === 'priority') {
      for (const p of PRIORITIES) res.push({ key: p.id, title: priorityName(p.id), icon: <PriorityIcon priority={p.id} />, issues: map.get(p.id) ?? [] });
      return res.filter((l) => l.issues.length > 0);
    }
    if (groupBy === 'assignee') {
      const ids = [...map.keys()].filter((k) => k !== 'none');
      ids.sort((a, b) => (a === user.ghId ? -1 : b === user.ghId ? 1 : (board.memberInfo[a]?.login ?? a).localeCompare(board.memberInfo[b]?.login ?? b)));
      for (const id of ids) res.push({ key: id, title: memberOf(board, id)!.name, icon: <Avatar info={memberOf(board, id)} size={20} />, issues: map.get(id)! });
      res.push({ key: 'none', title: t('Unassigned'), icon: <Avatar info={null} size={20} />, issues: map.get('none') ?? [] });
      return res;
    }
    const epics = issues.filter((i) => isEpic(board, i)).sort((a, b) => a.rank - b.rank);
    for (const e of epics) {
      if (!map.has(e.id)) continue;
      res.push({ key: e.id, title: `${board.key}-${e.number} · ${e.title}`, icon: <TypeIcon type={board.issueTypes.find((t) => t.id === e.type)} />, issues: map.get(e.id)! });
    }
    res.push({ key: 'none', title: t('No epic'), issues: map.get('none') ?? [] });
    return res;
  }, [groupBy, visible, byId, board, issues, user.ghId]);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || !perms.edit) return;
    const { source, destination, draggableId } = r;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const issue = byId.get(draggableId);
    if (!issue) return;
    const [laneKey, colId] = destination.droppableId.split('::');
    const lane = lanes.find((l) => l.key === laneKey);
    const dest = (lane?.issues ?? []).filter((i) => i.status === colId && i.id !== issue.id).sort((a, b) => a.rank - b.rank);
    const before = dest[destination.index - 1];
    const after = dest[destination.index];
    let rank = rankBetween(before?.rank, after?.rank);
    // Halving the gap over and over runs out of floating-point precision. Then the whole column
    // (all lanes, filtered-out cards included) is renumbered around the dropped card.
    if ((before && !(rank > before.rank)) || (after && !(rank < after.rank))) {
      const column = issues.filter((i) => i.status === colId && i.id !== issue.id).sort((a, b) => a.rank - b.rank);
      const at = before ? column.findIndex((i) => i.id === before.id) + 1 : after ? Math.max(0, column.findIndex((i) => i.id === after.id)) : column.length;
      column.splice(at, 0, issue);
      rank = (at + 1) * 1000;
      const renumber = column.flatMap((x, k) => (x.id !== issue.id && x.rank !== (k + 1) * 1000 ? [{ id: x.id, patch: { rank: (k + 1) * 1000 }, changes: [] }] : []));
      run(store.updateIssues(board.id, user, renumber));
    }
    const patch: Partial<Issue> = { rank };
    if (colId !== issue.status) patch.status = colId;
    const [srcLane] = source.droppableId.split('::');
    if (srcLane !== laneKey) {
      if (groupBy === 'assignee') patch.assigneeId = laneKey === 'none' ? null : laneKey;
      if (groupBy === 'epic') patch.epicId = laneKey === 'none' ? null : laneKey;
      if (groupBy === 'priority') patch.priority = laneKey as Priority;
    }
    updateIssue(issue, patch);
  };

  const addColumn = async () => {
    const name = prompt(t('New column name'));
    if (!name?.trim()) return;
    await updateBoard({ columns: [...board.columns, { id: newColumnId(), name: name.trim(), category: 'progress', wip: 0 }] });
  };

  const quickCreate = async (status: string, title: string, laneKey: string) => {
    const col = board.columns.find((c) => c.id === status);
    const extra: Partial<Issue> = {};
    if (groupBy === 'assignee' && laneKey !== 'none') extra.assigneeId = laneKey;
    if (groupBy === 'epic' && laneKey !== 'none') extra.epicId = laneKey;
    if (groupBy === 'priority') extra.priority = laneKey as Priority;
    const inCol = issues.filter((i) => i.status === status);
    const draft = newIssueDraft(board, user, {
      title,
      status,
      rank: inCol.length ? Math.max(...inCol.map((i) => i.rank)) + 1000 : 1000,
      resolvedAt: col?.category === 'done' ? Date.now() : null,
      ...extra,
    });
    const created = await run(store.createIssue(board.id, user, draft));
    return !!created;
  };

  const countByCol = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) if (!isEpic(board, i) || showEpics) m.set(i.status, (m.get(i.status) ?? 0) + 1);
    return m;
  }, [issues, board, showEpics]);

  return (
    <div className="kanban-view">
      <div className="view-head">
        <h1>{board.name}</h1>
        <div className="view-actions">
          {perms.edit && (
            <button className="btn btn-primary" onClick={() => newIssue()}>
              <Icon name="plus" size={16} /> {t('Create issue')}
            </button>
          )}
        </div>
      </div>
      <FilterBar
        extra={
          <>
            <label className="inline-label">{t('Group by')}</label>
            <Select
              value={groupBy}
              onChange={(v) => {
                const g = (v as GroupBy) ?? 'none';
                setGroupBy(g);
                writePref('kb-group-' + board.id, g);
              }}
              options={[
                { value: 'none', label: t('None') },
                { value: 'assignee', label: fieldName(board, 'assigneeId') },
                { value: 'epic', label: fieldName(board, 'epicId') },
                { value: 'priority', label: fieldName(board, 'priority') },
              ]}
              triggerClass="filter-btn"
              width={180}
            />
            <button
              className={cls('filter-btn', !showEpics && 'is-active')}
              onClick={() => {
                setShowEpics(!showEpics);
                writePref('kb-epics-' + board.id, showEpics ? 'hide' : 'show');
              }}
              title={t('Hide epics from the board — they stay available in filters and grouping')}
            >
              {showEpics ? t('Hide epics') : t('Epics hidden')}
            </button>
          </>
        }
      />
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-scroll">
          <div className="kanban" style={{ ['--cols' as string]: board.columns.length }}>
            <div className="kanban-header-row">
              {board.columns.map((c) => {
                const count = countByCol.get(c.id) ?? 0;
                const over = c.wip > 0 && count > c.wip;
                return (
                  <div key={c.id} className={cls('column-head', `cat-${c.category}`, over && 'is-over')}>
                    <span className="column-name">{c.name}</span>
                    <span className="column-count">
                      {count}
                      {c.wip > 0 && ` / ${c.wip}`}
                    </span>
                    {c.category === 'done' && <Icon name="check" size={14} className="column-done-icon" />}
                  </div>
                );
              })}
              {perms.admin && (
                <button className="column-add" onClick={addColumn} title={t('Add column')}>
                  <Icon name="plus" size={16} />
                </button>
              )}
            </div>
            {lanes.map((lane) => {
              const isCollapsed = collapsed.has(lane.key);
              return (
                <div key={lane.key} className="lane">
                  {groupBy !== 'none' && (
                    <button
                      className="lane-head"
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(lane.key)) n.delete(lane.key);
                          else n.add(lane.key);
                          return n;
                        })
                      }
                    >
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={14} />
                      {lane.icon}
                      <span className="lane-title">{lane.title}</span>
                      <span className="muted small">{lane.issues.length}</span>
                    </button>
                  )}
                  {!isCollapsed && (
                    <div className="lane-row">
                      {board.columns.map((c, ci) => {
                        const list = lane.issues.filter((i) => i.status === c.id).sort((a, b) => a.rank - b.rank);
                        return (
                          <Droppable key={c.id} droppableId={`${lane.key}::${c.id}`} isDropDisabled={!perms.edit}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.droppableProps} className={cls('column', s.isDraggingOver && 'is-over')}>
                                {list.map((i, idx) => (
                                  <Draggable key={i.id} draggableId={i.id} index={idx} isDragDisabled={!perms.edit}>
                                    {(dp, ds) => (
                                      <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} className="card-wrap" style={dp.draggableProps.style}>
                                        <IssueCard board={board} issue={i} epic={i.epicId ? byId.get(i.epicId) : undefined} onOpen={openIssue} dragging={ds.isDragging} />
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {p.placeholder}
                                {perms.edit && (ci === 0 || list.length > 0 || groupBy === 'none') && (
                                  <QuickCreate onCreate={(title) => quickCreate(c.id, title, lane.key)} />
                                )}
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                      {perms.admin && <div className="column-add-spacer" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
});

function QuickCreate({ onCreate }: { onCreate: (title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button className="quick-create-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> {t('Create issue')}
      </button>
    );
  }
  const submit = async () => {
    const t = v.trim();
    if (!t) return setOpen(false);
    setBusy(true);
    const ok = await onCreate(t);
    setBusy(false);
    if (ok) setV('');
  };
  return (
    <div className="quick-create">
      <textarea
        autoFocus
        rows={2}
        value={v}
        maxLength={500}
        disabled={busy}
        placeholder={t('What needs to be done? (Enter — create, Esc — cancel)')}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setV('');
          }
        }}
        onBlur={() => !v.trim() && setOpen(false)}
      />
      <div className="quick-create-actions">
        <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={busy}>
          {t('Create')}
        </button>
        <button className="btn btn-subtle btn-sm" onClick={() => (setOpen(false), setV(''))}>
          {t('Cancel')}
        </button>
      </div>
    </div>
  );
}
