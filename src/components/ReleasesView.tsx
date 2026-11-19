import { useState } from 'react';
import type { Version } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { EMPTY_FILTERS } from '../lib/issues';
import { columnCategory, formatDate, todayISO, uid, cls } from '../lib/utils';
import { useBoard } from './board-context';
import { Icon, TypeIcon } from './Icons';
import { ActionMenu, Avatar, EmptyState, Field, Modal, ProgressBar, memberOf } from './ui';
import { StatusBadge } from './IssueFields';

const STATUS_NAME: Record<Version['status'], string> = { unreleased: 'Не выпущена', released: 'Выпущена', archived: 'В архиве' };

export function ReleasesView() {
  const { confirm } = useApp();
  const { board, issues, perms, updateBoard, openIssue, setFilters } = useBoard();
  const [editing, setEditing] = useState<Version | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const versions = board.versions.filter((v) => showArchived || v.status !== 'archived');
  const save = (v: Version) => {
    const exists = board.versions.some((x) => x.id === v.id);
    updateBoard({ versions: exists ? board.versions.map((x) => (x.id === v.id ? v : x)) : [...board.versions, v] });
    setEditing(null);
  };
  const setStatus = (v: Version, status: Version['status']) => {
    const patch: Partial<Version> = { status };
    if (status === 'released' && !v.releaseDate) patch.releaseDate = todayISO();
    updateBoard({ versions: board.versions.map((x) => (x.id === v.id ? { ...x, ...patch } : x)) });
  };
  const remove = async (v: Version) => {
    const n = issues.filter((i) => i.fixVersionId === v.id).length;
    const ok = await confirm({ title: `Удалить версию «${v.name}»?`, text: n ? `У ${n} задач поле «Версия» станет пустым.` : undefined, confirmText: 'Удалить', danger: true });
    if (ok) updateBoard({ versions: board.versions.filter((x) => x.id !== v.id) });
  };
  const move = (v: Version, dir: -1 | 1) => {
    const list = [...board.versions];
    const i = list.findIndex((x) => x.id === v.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateBoard({ versions: list });
  };

  return (
    <div className="releases-view">
      <div className="view-head">
        <h1>Релизы</h1>
        <div className="view-actions">
          <label className="check-row">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Показать архив
          </label>
          {perms.admin && (
            <button className="btn btn-primary" onClick={() => setEditing({ id: 'v-' + uid(6), name: '', description: '', status: 'unreleased', startDate: null, releaseDate: null })}>
              <Icon name="plus" size={16} /> Версия
            </button>
          )}
        </div>
      </div>
      <p className="muted">
        Версии (вехи, спринты, месяцы) группируют задачи: «Прототип → Alpha → Beta → 1.0» в геймдеве или «Декабрь», «Новый год» для дома.
      </p>
      {versions.length === 0 ? (
        <EmptyState icon="release" title="Версий пока нет">
          {perms.admin && <p className="muted">Создайте первую версию, чтобы планировать релизы.</p>}
        </EmptyState>
      ) : (
        <div className="release-list">
          {versions.map((v) => {
            const list = issues.filter((i) => i.fixVersionId === v.id);
            const done = list.filter((i) => columnCategory(board, i.status) === 'done').length;
            const prog = list.filter((i) => columnCategory(board, i.status) === 'progress').length;
            const overdue = v.status === 'unreleased' && v.releaseDate && v.releaseDate < todayISO();
            const open = expanded === v.id;
            return (
              <div key={v.id} className={cls('release', `release-${v.status}`)}>
                <div className="release-row" onClick={() => setExpanded(open ? null : v.id)} role="button" tabIndex={0}>
                  <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
                  <div className="release-name">
                    <b>{v.name}</b>
                    {v.description && <div className="muted small">{v.description}</div>}
                  </div>
                  <span className={cls('lozenge', v.status === 'released' ? 'lozenge-done' : v.status === 'archived' ? 'lozenge-todo' : overdue ? 'lozenge-danger' : 'lozenge-progress')}>
                    {overdue ? 'Просрочена' : STATUS_NAME[v.status]}
                  </span>
                  <div className="release-progress">
                    <ProgressBar done={done} progress={prog} total={list.length} />
                    <span className="muted small">
                      {done}/{list.length}
                    </span>
                  </div>
                  <div className="release-dates muted small">
                    {v.startDate ? formatDate(v.startDate) : '—'} → {v.releaseDate ? formatDate(v.releaseDate) : '—'}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      actions={[
                        {
                          label: 'Показать на доске',
                          icon: 'board',
                          onClick: () => {
                            setFilters({ ...EMPTY_FILTERS, versions: [v.id] });
                            navigate(`/b/${board.id}`);
                          },
                        },
                        { label: 'Изменить', icon: 'edit', onClick: () => setEditing(v), hidden: !perms.admin },
                        { label: 'Выпустить', icon: 'check', onClick: () => setStatus(v, 'released'), hidden: !perms.admin || v.status === 'released' },
                        { label: 'Отменить выпуск', icon: 'history', onClick: () => setStatus(v, 'unreleased'), hidden: !perms.admin || v.status !== 'released' },
                        { label: 'В архив', icon: 'download', onClick: () => setStatus(v, 'archived'), hidden: !perms.admin || v.status === 'archived' },
                        { label: 'Из архива', icon: 'upload', onClick: () => setStatus(v, 'unreleased'), hidden: !perms.admin || v.status !== 'archived' },
                        { label: 'Выше', icon: 'arrowUp', onClick: () => move(v, -1), hidden: !perms.admin },
                        { label: 'Ниже', icon: 'arrowDown', onClick: () => move(v, 1), hidden: !perms.admin },
                        { label: 'Удалить', icon: 'trash', onClick: () => remove(v), danger: true, hidden: !perms.admin },
                      ]}
                    />
                  </div>
                </div>
                {open && (
                  <div className="release-issues">
                    {list.length === 0 && <div className="muted small">Нет задач в этой версии</div>}
                    {list
                      .sort((a, b) => board.columns.findIndex((c) => c.id === a.status) - board.columns.findIndex((c) => c.id === b.status))
                      .map((i) => (
                        <div key={i.id} className="issue-row" onClick={() => openIssue(i)} role="button" tabIndex={0}>
                          <TypeIcon type={board.issueTypes.find((t) => t.id === i.type)} />
                          <span className="issue-row-key">
                            {board.key}-{i.number}
                          </span>
                          <span className="issue-row-title">{i.title}</span>
                          <Avatar info={memberOf(board, i.assigneeId)} size={20} />
                          <StatusBadge board={board} status={i.status} />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <VersionDialog version={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function VersionDialog({ version, onSave, onClose }: { version: Version; onSave: (v: Version) => void; onClose: () => void }) {
  const [v, setV] = useState(version);
  return (
    <Modal
      title={version.name ? `Версия «${version.name}»` : 'Новая версия'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={!v.name.trim()} onClick={() => onSave({ ...v, name: v.name.trim() })}>
            Сохранить
          </button>
        </>
      }
    >
      <Field label="Название *">
        <input className="input" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="напр. Alpha 0.3 или Январь" />
      </Field>
      <div className="form-grid">
        <Field label="Начало">
          <input className="input" type="date" value={v.startDate ?? ''} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} />
        </Field>
        <Field label="Дата выпуска">
          <input className="input" type="date" value={v.releaseDate ?? ''} onChange={(e) => setV({ ...v, releaseDate: e.target.value || null })} />
        </Field>
      </div>
      <Field label="Описание">
        <textarea className="input" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
    </Modal>
  );
}
