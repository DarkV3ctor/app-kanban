import { memo, useMemo, useState } from 'react';
import type { Board, FieldKey } from '../types';
import { useApp } from '../app-context';
import { fieldName, genericFieldName, hasField } from '../lib/fields';
import { t, tk } from '../i18n';
import { applyFilters, epicOf, sortIssues, type SortKey } from '../lib/issues';
import { downloadFile, dueState, formatDate, isDone, priorityName, timeAgo, cls } from '../lib/utils';
import { useBoard } from './board-context';
import { FilterBar } from './FilterBar';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { Avatar, EmptyState, memberOf } from './ui';
import { StatusBadge } from './IssueFields';

/** `field`: the column shows that field, under the board's name for it (short columns keep their abbreviation until renamed). */
const COLS: { key: SortKey; label: string; field?: FieldKey; className?: string }[] = [
  { key: 'type', label: tk('Type'), field: 'type', className: 'col-type' },
  { key: 'key', label: tk('Key'), className: 'col-key' },
  { key: 'title', label: tk('Summary'), className: 'col-title' },
  { key: 'status', label: tk('Status') },
  { key: 'assignee', label: tk('Assignee'), field: 'assigneeId' },
  { key: 'priority', label: tk('Priority'), field: 'priority' },
  { key: 'version', label: tk('Version'), field: 'fixVersionId' },
  { key: 'build', label: tk('Build'), field: 'build' },
  { key: 'points', label: tk('SP'), field: 'storyPoints', className: 'col-num' },
  { key: 'due', label: tk('Due'), field: 'dueDate' },
  { key: 'updated', label: tk('Updated') },
];

/** A column's header: the board's name for the field once it differs from the generic one. */
function colLabel(board: Board, c: (typeof COLS)[number]): string {
  if (!c.field) return t(c.label);
  const name = fieldName(board, c.field);
  return name === genericFieldName(c.field) ? t(c.label) : name;
}

const CSV_HEAD = [tk('Key'), tk('Type'), tk('Summary'), tk('Status'), tk('Assignee'), tk('Priority'), tk('Labels'), tk('Version'), tk('Build'), tk('Epic'), tk('SP'), tk('Due'), tk('Created'), tk('Updated')];

// Memoized: re-renders only when the board context changes, not on every BoardPage render.
export const ListView = memo(function ListView() {
  const { user } = useApp();
  const { board, issues, byId, filters, openIssue, newIssue, perms } = useBoard();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'key', dir: -1 });

  const rows = useMemo(() => sortIssues(board, applyFilters(board, issues, filters, user), sort.key, sort.dir), [board, issues, filters, user, sort]);
  const points = rows.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  // The build column (table and CSV) only on boards that have the field (game dev).
  const withBuild = hasField(board, 'build');
  const cols = COLS.filter((c) => !c.field || hasField(board, c.field));

  const exportCsv = () => {
    // Every cell is quoted; text that a spreadsheet would run as a formula (=, +, -, @, tab, CR at the
    // start) gets a leading apostrophe, so an issue title cannot inject formulas into the export.
    const esc = (s: string) => {
      const cell = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
      return `"${cell.replace(/"/g, '""')}"`;
    };
    const head =CSV_HEAD.filter((h) => withBuild || h !== 'Build');
    const lines = rows.map((i) => {
      const epic = epicOf(board, byId, i);
      return [
        `${board.key}-${i.number}`,
        board.issueTypes.find((x) => x.id === i.type)?.name ?? i.type,
        i.title,
        board.columns.find((c) => c.id === i.status)?.name ?? i.status,
        i.assigneeId ? board.memberInfo[i.assigneeId]?.login ?? '' : '',
        priorityName(i.priority),
        i.labels.join(' '),
        board.versions.find((v) => v.id === i.fixVersionId)?.name ?? '',
        ...(withBuild ? [i.build] : []),
        epic ? `${board.key}-${epic.number}` : '',
        i.storyPoints ?? '',
        i.dueDate ?? '',
        new Date(i.createdAt).toISOString(),
        new Date(i.updatedAt).toISOString(),
      ]
        .map((v) => esc(String(v)))
        .join(',');
    });
    // BOM so Excel detects UTF-8.
    downloadFile(`${board.key}-issues.csv`, '﻿' + [head.map((h) => esc(t(h))).join(','), ...lines].join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <div className="list-view">
      <div className="view-head">
        <h1>{t('Issue list')}</h1>
        <div className="view-actions">
          <button className="btn btn-subtle" onClick={exportCsv} title={t('Download the filtered list as CSV (Excel)')}>
            <Icon name="download" size={16} /> CSV
          </button>
          {perms.edit && (
            <button className="btn btn-primary" onClick={() => newIssue()}>
              <Icon name="plus" size={16} /> {t('Create issue')}
            </button>
          )}
        </div>
      </div>
      <FilterBar showHideDone />
      <div className="muted small list-summary">{t('Showing {shown} of {total} · story points: {points}', { shown: rows.length, total: issues.length, points })}</div>
      {rows.length === 0 ? (
        <EmptyState icon="search" title={t('No issues found')}>
          <p className="muted">{t('Change the filters or create a new issue.')}</p>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="issue-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={c.className}>
                    <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                      {colLabel(board, c)}
                      {sort.key === c.key && <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDown'} size={12} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const done = isDone(board, i);
                const due = dueState(i.dueDate, done);
                const epic = epicOf(board, byId, i);
                const a = memberOf(board, i.assigneeId);
                return (
                  <tr key={i.id} onClick={() => openIssue(i)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openIssue(i)}>
                    <td className="col-type">
                      <TypeIcon type={board.issueTypes.find((x) => x.id === i.type)} />
                    </td>
                    <td className={cls('col-key', done && 'is-done')}>
                      {board.key}-{i.number}
                    </td>
                    <td className="col-title">
                      <div className="cell-title">{i.title}</div>
                      {epic && <div className="muted small">{t('Epic: {name}', { name: epic.title })}</div>}
                    </td>
                    <td>
                      <StatusBadge board={board} status={i.status} />
                    </td>
                    <td>
                      <span className="cell-person">
                        <Avatar info={a} size={20} />
                        <span>{a ? a.name : <span className="muted">—</span>}</span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-person">
                        <PriorityIcon priority={i.priority} />
                      </span>
                    </td>
                    <td>{board.versions.find((v) => v.id === i.fixVersionId)?.name ?? <span className="muted">—</span>}</td>
                    {withBuild && <td>{i.build || <span className="muted">—</span>}</td>}
                    <td className="col-num">{i.storyPoints ?? ''}</td>
                    <td className={cls(due && `due-${due}`)}>{formatDate(i.dueDate)}</td>
                    <td className="muted small">{timeAgo(i.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
