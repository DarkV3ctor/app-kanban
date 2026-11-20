import type { ReactNode } from 'react';
import { useApp } from '../app-context';
import { EMPTY_FILTERS, filtersActive, isEpic, type Filters } from '../lib/issues';
import { PRIORITIES, cls } from '../lib/utils';
import { fieldName, nobodyLabel, priorityLabel } from '../lib/fields';
import { t } from '../i18n';
import type { Priority } from '../types';
import { useBoard } from './board-context';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { Avatar, Select, memberOf } from './ui';

function FilterSelect({ label, value, options, onChange }: { label: string; value: string[]; options: { value: string; label: string; icon?: ReactNode }[]; onChange: (v: string[]) => void }) {
  return (
    <Select
      multi
      options={options}
      value={value}
      onChange={(v) => onChange((v as string[]) ?? [])}
      triggerClass={cls('filter-btn', value.length > 0 && 'is-active')}
      renderValue={(sel) => (
        <span>
          {label}
          {sel.length > 0 && <span className="filter-count">{sel.length}</span>}
        </span>
      )}
      width={240}
    />
  );
}

export function FilterBar({ extra, showHideDone }: { extra?: ReactNode; showHideDone?: boolean }) {
  const { user } = useApp();
  const { board, issues, filters, setFilters } = useBoard();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });

  const members = board.memberIds.filter((id) => board.members[id]);
  const assigneeIds = [...new Set([...members, ...issues.map((i) => i.assigneeId).filter((x): x is string => !!x)])];
  const epics = issues.filter((i) => isEpic(board, i));

  const toggleAssignee = (id: string) => {
    const s = new Set(filters.assignees);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set('assignees', [...s]);
  };

  return (
    <div className="filter-bar">
      <label className="filter-search">
        <Icon name="search" size={16} />
        <input value={filters.text} onChange={(e) => set('text', e.target.value)} placeholder={t('Search issues')} aria-label={t('Search issues')} />
        {filters.text && (
          <button className="icon-btn" onClick={() => set('text', '')} aria-label={t('Clear search')}>
            <Icon name="close" size={12} />
          </button>
        )}
      </label>
      <div className="filter-avatars">
        {assigneeIds.slice(0, 8).map((id) => (
          <button key={id} className={cls('filter-avatar', filters.assignees.includes(id) && 'is-active')} onClick={() => toggleAssignee(id)} title={memberOf(board, id)!.name}>
            <Avatar info={memberOf(board, id)} size={30} />
          </button>
        ))}
        <button className={cls('filter-avatar', filters.assignees.includes('none') && 'is-active')} onClick={() => toggleAssignee('none')} title={nobodyLabel(board)}>
          <Avatar info={null} size={30} title={nobodyLabel(board)} />
        </button>
      </div>
      <FilterSelect label={fieldName(board, 'type')} value={filters.types} onChange={(v) => set('types', v)} options={board.issueTypes.map((t) => ({ value: t.id, label: t.name, icon: <TypeIcon type={t} /> }))} />
      <FilterSelect
        label={fieldName(board, 'priority')}
        value={filters.priorities}
        onChange={(v) => set('priorities', v as Priority[])}
        options={PRIORITIES.map((p) => {
          const name = priorityLabel(board, p.id);
          return { value: p.id, label: name, icon: <PriorityIcon priority={p.id} name={name} /> };
        })}
      />
      {board.labels.length > 0 && <FilterSelect label={fieldName(board, 'labels')} value={filters.labels} onChange={(v) => set('labels', v)} options={board.labels.map((l) => ({ value: l, label: l }))} />}
      {board.components.length > 0 && (
        <FilterSelect label={fieldName(board, 'components')} value={filters.components} onChange={(v) => set('components', v)} options={board.components.map((l) => ({ value: l, label: l }))} />
      )}
      {board.versions.length > 0 && (
        <FilterSelect
          label={fieldName(board, 'fixVersionId')}
          value={filters.versions}
          onChange={(v) => set('versions', v)}
          options={[...board.versions.filter((v) => v.status !== 'archived').map((v) => ({ value: v.id, label: v.name, icon: <Icon name="release" size={14} /> })), { value: 'none', label: t('No version') }]}
        />
      )}
      {epics.length > 0 && (
        <FilterSelect
          label={fieldName(board, 'epicId')}
          value={filters.epics}
          onChange={(v) => set('epics', v)}
          options={[...epics.map((e) => ({ value: e.id, label: `${board.key}-${e.number} ${e.title}`, icon: <TypeIcon type={board.issueTypes.find((t) => t.id === e.type)} /> })), { value: 'none', label: t('No epic') }]}
        />
      )}
      <button className={cls('filter-btn', filters.onlyMine && 'is-active')} onClick={() => set('onlyMine', !filters.onlyMine)} title={t('Assigned to @{login}', { login: user.login })}>
        {t('My issues')}
      </button>
      <button className={cls('filter-btn', filters.recent && 'is-active')} onClick={() => set('recent', !filters.recent)}>
        {t('Updated this week')}
      </button>
      {showHideDone && (
        <button className={cls('filter-btn', filters.hideDone && 'is-active')} onClick={() => set('hideDone', !filters.hideDone)}>
          {t('Hide done')}
        </button>
      )}
      {filtersActive(filters) && (
        <button className="btn btn-link" onClick={() => setFilters(EMPTY_FILTERS)}>
          {t('Clear filters')}
        </button>
      )}
      {extra && <div className="filter-extra">{extra}</div>}
    </div>
  );
}
