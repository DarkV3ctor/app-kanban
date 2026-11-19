import { useState } from 'react';
import type { Version } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { t, tk } from '../i18n';
import { EMPTY_FILTERS } from '../lib/issues';
import { columnCategory, formatDate, todayISO, uid, cls } from '../lib/utils';
import { useBoard } from './board-context';
import { Icon, TypeIcon } from './Icons';
import { ActionMenu, Avatar, EmptyState, Field, Modal, ProgressBar, memberOf } from './ui';
import { StatusBadge } from './IssueFields';

const STATUS_NAME: Record<Version['status'], string> = { unreleased: tk('Unreleased'), released: tk('Released'), archived: tk('Archived') };

export function ReleasesView() {
  const { store, user, run, confirm } = useApp();
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
    const inVersion = issues.filter((i) => i.fixVersionId === v.id);
    const ok = await confirm({
      title: t('Delete version "{name}"?', { name: v.name }),
      text: inVersion.length ? t('Issues in this version ({n}) will lose their fix version.', { n: inVersion.length }) : undefined,
      confirmText: t('Delete'),
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      for (const i of inVersion) {
        await store.updateIssue(board.id, i.id, { fixVersionId: null }, user, [{ field: 'fixVersionId', from: v.name, to: '' }]);
      }
      await store.updateBoard(board.id, { versions: board.versions.filter((x) => x.id !== v.id) });
    });
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
        <h1>{t('Releases')}</h1>
        <div className="view-actions">
          <label className="check-row">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t('Show archived')}
          </label>
          {perms.admin && (
            <button className="btn btn-primary" onClick={() => setEditing({ id: 'v-' + uid(6), name: '', description: '', status: 'unreleased', startDate: null, releaseDate: null })}>
              <Icon name="plus" size={16} /> {t('Version')}
            </button>
          )}
        </div>
      </div>
      <p className="muted">{t('Versions (milestones, sprints, months) group issues: "Prototype → Alpha → Beta → 1.0" in game dev, or "December", "New Year" at home.')}</p>
      {versions.length === 0 ? (
        <EmptyState icon="release" title={t('No versions yet')}>
          {perms.admin && <p className="muted">{t('Create the first version to plan releases.')}</p>}
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
                    {overdue ? t('Overdue') : t(STATUS_NAME[v.status])}
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
                          label: t('Show on board'),
                          icon: 'board',
                          onClick: () => {
                            setFilters({ ...EMPTY_FILTERS, versions: [v.id] });
                            navigate(`/b/${board.id}`);
                          },
                        },
                        { label: t('Edit'), icon: 'edit', onClick: () => setEditing(v), hidden: !perms.admin },
                        { label: t('Release'), icon: 'check', onClick: () => setStatus(v, 'released'), hidden: !perms.admin || v.status === 'released' },
                        { label: t('Unrelease'), icon: 'history', onClick: () => setStatus(v, 'unreleased'), hidden: !perms.admin || v.status !== 'released' },
                        { label: t('Archive'), icon: 'download', onClick: () => setStatus(v, 'archived'), hidden: !perms.admin || v.status === 'archived' },
                        { label: t('Restore from archive'), icon: 'upload', onClick: () => setStatus(v, 'unreleased'), hidden: !perms.admin || v.status !== 'archived' },
                        { label: t('Move up'), icon: 'arrowUp', onClick: () => move(v, -1), hidden: !perms.admin },
                        { label: t('Move down'), icon: 'arrowDown', onClick: () => move(v, 1), hidden: !perms.admin },
                        { label: t('Delete'), icon: 'trash', onClick: () => remove(v), danger: true, hidden: !perms.admin },
                      ]}
                    />
                  </div>
                </div>
                {open && (
                  <div className="release-issues">
                    {list.length === 0 && <div className="muted small">{t('No issues in this version')}</div>}
                    {list
                      .sort((a, b) => board.columns.findIndex((c) => c.id === a.status) - board.columns.findIndex((c) => c.id === b.status))
                      .map((i) => (
                        <div key={i.id} className="issue-row" onClick={() => openIssue(i)} role="button" tabIndex={0}>
                          <TypeIcon type={board.issueTypes.find((x) => x.id === i.type)} />
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
      title={version.name ? t('Version "{name}"', { name: version.name }) : t('New version')}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" disabled={!v.name.trim()} onClick={() => onSave({ ...v, name: v.name.trim() })}>
            {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Name *')}>
        <input className="input" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t('e.g. Alpha 0.3 or January')} />
      </Field>
      <div className="form-grid">
        <Field label={t('Start date')}>
          <input className="input" type="date" value={v.startDate ?? ''} onChange={(e) => setV({ ...v, startDate: e.target.value || null })} />
        </Field>
        <Field label={t('Release date')}>
          <input className="input" type="date" value={v.releaseDate ?? ''} onChange={(e) => setV({ ...v, releaseDate: e.target.value || null })} />
        </Field>
      </div>
      <Field label={t('Description')}>
        <textarea className="input" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
    </Modal>
  );
}
