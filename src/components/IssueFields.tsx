import { useMemo } from 'react';
import type { Board, Issue, Priority } from '../types';
import { PRIORITIES, roleRank } from '../lib/utils';
import { assignToMeLabel, nobodyLabel, priorityLabel } from '../lib/fields';
import { t } from '../i18n';
import { isEpic } from '../lib/issues';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { Avatar, LabelChip, Select, StatusLozenge, memberOf } from './ui';

interface Common {
  board: Board;
  disabled?: boolean;
}

export function AssigneePicker({ board, value, onChange, disabled, meId, placeholder = nobodyLabel(board) }: Common & { value: string | null; onChange: (v: string | null) => void; meId?: string; placeholder?: string }) {
  const options = useMemo(() => {
    const ids = board.memberIds.filter((id) => roleRank(board, id) >= 1);
    if (value && !ids.includes(value)) ids.push(value);
    return ids.map((id) => {
      const m = memberOf(board, id)!;
      return { value: id, label: m.name, hint: m.login ? `@${m.login}` : undefined, icon: <Avatar info={m} size={20} /> };
    });
  }, [board, value]);
  return (
    <div className="assignee-picker">
      <Select
        options={options}
        value={value}
        onChange={(v) => onChange((v as string) ?? null)}
        clearable
        clearLabel={nobodyLabel(board)}
        disabled={disabled}
        searchable
        renderValue={(sel) =>
          sel[0] ? (
            <span className="select-value-item">
              <Avatar info={memberOf(board, sel[0].value as string)} size={22} />
              <span>{sel[0].label}</span>
            </span>
          ) : (
            <span className="select-value-item">
              <Avatar info={null} size={22} title={nobodyLabel(board)} />
              <span className="select-placeholder">{placeholder}</span>
            </span>
          )
        }
      />
      {meId && !disabled && value !== meId && board.memberIds.includes(meId) && (
        <button type="button" className="btn btn-link btn-sm" onClick={() => onChange(meId)}>
          {assignToMeLabel(board)}
        </button>
      )}
    </div>
  );
}

export function TypePicker({ board, value, onChange, disabled, excludeEpic }: Common & { value: string; onChange: (v: string) => void; excludeEpic?: boolean }) {
  return (
    <Select
      options={board.issueTypes.filter((t) => !excludeEpic || !t.isEpic).map((t) => ({ value: t.id, label: t.name, icon: <TypeIcon type={t} /> }))}
      value={value}
      onChange={(v) => v && onChange(v as string)}
      disabled={disabled}
    />
  );
}

export function PriorityPicker({ board, value, onChange, disabled }: Common & { value: Priority; onChange: (v: Priority) => void }) {
  return (
    <Select
      options={PRIORITIES.map((p) => {
        const name = priorityLabel(board, p.id);
        return { value: p.id, label: name, icon: <PriorityIcon priority={p.id} name={name} /> };
      })}
      value={value}
      onChange={(v) => v && onChange(v as Priority)}
      disabled={disabled}
    />
  );
}

export function StatusPicker({ board, value, onChange, disabled }: Common & { value: string; onChange: (v: string) => void }) {
  const col = board.columns.find((c) => c.id === value);
  return (
    <Select
      options={board.columns.map((c) => ({ value: c.id, label: c.name, icon: <span className={`dot dot-${c.category}`} /> }))}
      value={value}
      onChange={(v) => v && onChange(v as string)}
      disabled={disabled}
      triggerClass={`status-trigger status-${col?.category ?? 'todo'}`}
      renderValue={() => <span>{col?.name ?? t('Status')}</span>}
      width={220}
    />
  );
}

export function StatusBadge({ board, status }: { board: Board; status: string }) {
  const col = board.columns.find((c) => c.id === status);
  return <StatusLozenge category={col?.category ?? 'todo'}>{col?.name ?? status}</StatusLozenge>;
}

export function VersionPicker({ board, value, onChange, disabled }: Common & { value: string | null; onChange: (v: string | null) => void }) {
  const opts = board.versions
    .filter((v) => v.status !== 'archived' || v.id === value)
    .map((v) => ({ value: v.id, label: v.name, hint: v.status === 'released' ? t('released') : v.status === 'archived' ? t('archived') : undefined, icon: <Icon name="release" size={14} /> }));
  return <Select options={opts} value={value} onChange={(v) => onChange((v as string) ?? null)} clearable clearLabel={t('None')} placeholder={t('None')} disabled={disabled} />;
}

export function EpicPicker({ board, issues, value, onChange, disabled, selfId }: Common & { issues: Issue[]; value: string | null; onChange: (v: string | null) => void; selfId?: string }) {
  const epics = issues.filter((i) => isEpic(board, i) && i.id !== selfId);
  return (
    <Select
      options={epics.map((e) => ({ value: e.id, label: e.title, hint: `${board.key}-${e.number}`, icon: <TypeIcon type={board.issueTypes.find((t) => t.id === e.type)} /> }))}
      value={value && epics.some((e) => e.id === value) ? value : null}
      onChange={(v) => onChange((v as string) ?? null)}
      clearable
      clearLabel={t('None')}
      placeholder={t('None')}
      disabled={disabled}
      searchable
    />
  );
}

export function LabelsPicker({ board, issues, value, onChange, disabled }: Common & { issues: Issue[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = useMemo(() => {
    const s = new Set(board.labels);
    issues.forEach((i) => i.labels.forEach((l) => s.add(l)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [board.labels, issues]);
  return (
    <Select
      multi
      allowCreate
      createLabel={(q) => t('New label "{name}"', { name: q })}
      options={all.map((l) => ({ value: l, label: l }))}
      value={value}
      onChange={(v) => onChange(((v as string[]) ?? []).map((x) => x.trim().replace(/\s+/g, '-')).filter(Boolean))}
      disabled={disabled}
      placeholder={t('None')}
      renderValue={(sel) =>
        sel.length ? (
          <span className="chips">
            {sel.map((o) => (
              <LabelChip key={o.value} text={o.value} />
            ))}
          </span>
        ) : (
          <span className="select-placeholder">{t('None')}</span>
        )
      }
    />
  );
}

export function ComponentsPicker({ board, value, onChange, disabled }: Common & { value: string[]; onChange: (v: string[]) => void }) {
  if (!board.components.length) return <span className="muted small">{t('No components configured')}</span>;
  return (
    <Select
      multi
      options={board.components.map((c) => ({ value: c, label: c }))}
      value={value}
      onChange={(v) => onChange((v as string[]) ?? [])}
      disabled={disabled}
      placeholder={t('None')}
      renderValue={(sel) => (sel.length ? <span>{sel.map((s) => s.label).join(', ')}</span> : <span className="select-placeholder">{t('None')}</span>)}
    />
  );
}
