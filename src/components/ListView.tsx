import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { applyFilters, sortIssues, type SortKey } from '../lib/issues';
import { dueState, formatDate, isDone, timeAgo, cls } from '../lib/utils';
import { useBoard } from './board-context';
import { FilterBar } from './FilterBar';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { Avatar, EmptyState, memberOf } from './ui';
import { StatusBadge } from './IssueFields';

const COLS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'type', label: 'Тип', className: 'col-type' },
  { key: 'key', label: 'Ключ', className: 'col-key' },
  { key: 'title', label: 'Название', className: 'col-title' },
  { key: 'status', label: 'Статус' },
  { key: 'assignee', label: 'Исполнитель' },
  { key: 'priority', label: 'Приоритет' },
  { key: 'version', label: 'Версия' },
  { key: 'points', label: 'SP', className: 'col-num' },
  { key: 'due', label: 'Срок' },
  { key: 'updated', label: 'Обновлено' },
];

export function ListView() {
  const { user } = useApp();
  const { board, issues, byId, filters, openIssue, newIssue, perms } = useBoard();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'key', dir: -1 });

  const rows = useMemo(() => sortIssues(board, applyFilters(board, issues, filters, user), sort.key, sort.dir), [board, issues, filters, user, sort]);
  const points = rows.reduce((s, i) => s + (i.storyPoints ?? 0), 0);

  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const head = ['Ключ', 'Тип', 'Название', 'Статус', 'Исполнитель', 'Приоритет', 'Метки', 'Версия', 'Эпик', 'SP', 'Срок', 'Создано', 'Обновлено'];
    const lines = rows.map((i) =>
      [
        `${board.key}-${i.number}`,
        board.issueTypes.find((t) => t.id === i.type)?.name ?? i.type,
        i.title,
        board.columns.find((c) => c.id === i.status)?.name ?? i.status,
        i.assigneeId ? board.memberInfo[i.assigneeId]?.login ?? '' : '',
        i.priority,
        i.labels.join(' '),
        board.versions.find((v) => v.id === i.fixVersionId)?.name ?? '',
        i.epicId && byId.get(i.epicId) ? `${board.key}-${byId.get(i.epicId)!.number}` : '',
        i.storyPoints ?? '',
        i.dueDate ?? '',
        new Date(i.createdAt).toISOString(),
        new Date(i.updatedAt).toISOString(),
      ]
        .map((v) => esc(String(v)))
        .join(','),
    );
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${board.key}-issues.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="list-view">
      <div className="view-head">
        <h1>Список задач</h1>
        <div className="view-actions">
          <button className="btn btn-subtle" onClick={exportCsv} title="Скачать отфильтрованный список в CSV (Excel)">
            <Icon name="download" size={16} /> CSV
          </button>
          {perms.edit && (
            <button className="btn btn-primary" onClick={() => newIssue()}>
              <Icon name="plus" size={16} /> Создать задачу
            </button>
          )}
        </div>
      </div>
      <FilterBar showHideDone />
      <div className="muted small list-summary">
        {rows.length} из {issues.length} задач · {points} story points
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="search" title="Задачи не найдены">
          <p className="muted">Измените фильтры или создайте новую задачу.</p>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="issue-table">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className={c.className}>
                    <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                      {c.label}
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
                const epic = i.epicId ? byId.get(i.epicId) : undefined;
                const a = memberOf(board, i.assigneeId);
                return (
                  <tr key={i.id} onClick={() => openIssue(i)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openIssue(i)}>
                    <td className="col-type">
                      <TypeIcon type={board.issueTypes.find((t) => t.id === i.type)} />
                    </td>
                    <td className={cls('col-key', done && 'is-done')}>
                      {board.key}-{i.number}
                    </td>
                    <td className="col-title">
                      <div className="cell-title">{i.title}</div>
                      {epic && <div className="muted small">Эпик: {epic.title}</div>}
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
}
