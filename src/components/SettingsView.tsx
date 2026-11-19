import { useEffect, useState } from 'react';
import type { Column, ColumnCategory, FieldNames, IssueType } from '../types';
import { useApp, useDiscardGuard } from '../app-context';
import { navigate } from '../router';
import { count, t } from '../i18n';
import { exportBoard, statusSideEffects } from '../lib/issues';
import { FIELDS, MAX_FIELD_NAME, defaultFieldName, genericFieldName } from '../lib/fields';
import { downloadJSON, sanitizeKey, uid, cls } from '../lib/utils';
import { newColumnId } from '../templates';
import { useBoard } from './board-context';
import { Icon, TYPE_GLYPHS, TypeIcon } from './Icons';
import { Field, LabelChip, Modal, Select } from './ui';
import { MarkdownEditor } from './markdown';

const COLORS = ['#1D7AFC', '#22A06B', '#E2483D', '#E56910', '#B38600', '#904EE2', '#6E5DC6', '#CD519D', '#1D9AAA', '#626F86'];
const EMOJIS = ['🎮', '🏠', '💻', '📋', '🚀', '🎨', '🎵', '🧩', '🗺️', '🛒', '💰', '❤️', '📚', '🌱', '🚗', '🐾', '✈️', '🏋️', '🎯', '⭐'];

const issuesCount = (n: number) => count(n, 'issue');

export function SettingsView() {
  const { perms } = useBoard();
  if (!perms.admin) {
    return (
      <div className="settings-view">
        <div className="view-head">
          <h1>{t('Settings')}</h1>
        </div>
        <div className="alert alert-info">
          <Icon name="shield" size={16} />
          <span>
            {t('Board settings are available to admins and the owner.')}{' '}
            {perms.edit ? t('Your role lets you work with issues.') : perms.comment ? t('Your role lets you view and comment.') : t('Your role lets you view only.')}
          </span>
        </div>
        <BoardSummary />
        <ExportPanel />
      </div>
    );
  }
  return (
    <div className="settings-view">
      <div className="view-head">
        <h1>{t('Board settings')}</h1>
      </div>
      <General />
      <Columns />
      <IssueTypes />
      <FieldNamesPanel />
      <ListEditor title={t('Labels')} hint={t('Suggestions for the Labels field. Members can also create new labels right in an issue.')} field="labels" chips />
      <ListEditor title={t('Components')} hint={t('Project areas: "Gameplay", "Graphics"… or rooms and areas of life for a home board.')} field="components" />
      <ExportPanel />
      {perms.owner && <DangerZone />}
    </div>
  );
}

function BoardSummary() {
  const { board } = useBoard();
  return (
    <div className="panel">
      <div className="panel-title">
        {board.icon} {board.name} <span className="muted">({board.key})</span>
      </div>
      {board.description && <p>{board.description}</p>}
      <div className="muted small">
        {t('Columns:')} {board.columns.map((c) => c.name).join(' → ')}
      </div>
    </div>
  );
}

function General() {
  const { board, updateBoard } = useBoard();
  const [name, setName] = useState(board.name);
  const [key, setKey] = useState(board.key);
  const [description, setDescription] = useState(board.description);
  const dirty = name !== board.name || key !== board.key || description !== board.description;
  return (
    <div className="panel">
      <div className="panel-title">{t('General')}</div>
      <div className="form-grid">
        <Field label={t('Name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t('Key')} hint={key !== board.key ? t('All issues will be renamed: {from}-1 → {to}-1', { from: board.key, to: key || '?' }) : t('Prefix for issue numbers')}>
          <input className="input mono" value={key} onChange={(e) => setKey(sanitizeKey(e.target.value))} maxLength={10} />
        </Field>
      </div>
      <Field label={t('Description')}>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      </Field>
      <div className="form-grid">
        <Field label={t('Icon')}>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} type="button" className={cls('emoji-btn', board.icon === e && 'is-selected')} onClick={() => updateBoard({ icon: e })}>
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('Color')}>
          <div className="color-grid">
            {COLORS.map((c) => (
              <button key={c} type="button" className={cls('color-btn', board.color === c && 'is-selected')} style={{ background: c }} onClick={() => updateBoard({ color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={!dirty || !name.trim() || !key} onClick={() => updateBoard({ name: name.trim(), key, description: description.trim() })}>
          {t('Save')}
        </button>
      </div>
    </div>
  );
}

function Columns() {
  const { store, user, run, confirm } = useApp();
  const { board, issues, updateBoard } = useBoard();
  const [cols, setCols] = useState<Column[]>(board.columns);
  useEffect(() => setCols(board.columns), [board.columns]);
  const dirty = JSON.stringify(cols) !== JSON.stringify(board.columns);
  const categories: { value: ColumnCategory; label: string }[] = [
    { value: 'todo', label: t('To do') },
    { value: 'progress', label: t('In progress') },
    { value: 'done', label: t('Done') },
  ];

  const patch = (id: string, p: Partial<Column>) => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cols.length) return;
    const n = [...cols];
    [n[i], n[j]] = [n[j], n[i]];
    setCols(n);
  };

  const remove = async (c: Column) => {
    // A column that was never saved is only removed from the draft.
    if (!board.columns.some((x) => x.id === c.id)) {
      setCols((cs) => cs.filter((x) => x.id !== c.id));
      return;
    }
    if (board.columns.length <= 1) return;
    // Deleting saves the board, so it must not silently save other unsaved edits too.
    if (dirty) {
      await confirm({ title: t('Save or discard the column changes first'), confirmText: t('Got it') });
      return;
    }
    const inCol = issues.filter((i) => i.status === c.id);
    const target = board.columns.find((x) => x.id !== c.id)!;
    const ok = await confirm({
      title: t('Delete column "{name}"?', { name: c.name }),
      text: inCol.length ? t('Its issues ({n}) will be moved to "{target}".', { n: inCol.length, target: target.name }) : undefined,
      confirmText: t('Delete'),
      danger: true,
    });
    if (!ok) return;
    const next = board.columns.filter((x) => x.id !== c.id);
    await run(async () => {
      // Batched; moving between a "done" and another column also sets or clears the resolution date.
      await store.updateIssues(
        board.id,
        user,
        inCol.map((i) => ({ id: i.id, patch: { status: target.id, ...statusSideEffects(board, i, target.id) }, changes: [{ field: 'status', from: c.name, to: target.name }] })),
      );
      await store.updateBoard(board.id, { columns: next });
    });
  };

  return (
    <div className="panel">
      <div className="panel-title">{t('Columns (statuses)')}</div>
      <p className="muted small">
        {t('The category sets the status color and what counts as "done" (for releases, epic progress and resolution date). A WIP limit highlights an overloaded column.')}
      </p>
      <div className="settings-rows">
        <div className="settings-row settings-row-head">
          <span />
          <span>{t('Name')}</span>
          <span>{t('Category')}</span>
          <span>WIP</span>
          <span>{t('Issues')}</span>
          <span />
        </div>
        {cols.map((c, i) => (
          <div key={c.id} className="settings-row">
            <span className="row-move">
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move left')}>
                <Icon name="arrowUp" size={14} />
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label={t('Move right')}>
                <Icon name="arrowDown" size={14} />
              </button>
            </span>
            <input className="input" value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
            <Select options={categories} value={c.category} onChange={(v) => v && patch(c.id, { category: v as ColumnCategory })} triggerClass={`status-trigger status-${c.category}`} />
            <input className="input input-num" type="number" min={0} value={c.wip || ''} placeholder="∞" onChange={(e) => patch(c.id, { wip: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="muted">{issues.filter((x) => x.status === c.id).length}</span>
            <button className="icon-btn" onClick={() => remove(c)} disabled={cols.length <= 1} aria-label={t('Delete column')}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-subtle" onClick={() => setCols([...cols, { id: newColumnId(), name: t('New column'), category: 'progress', wip: 0 }])}>
          <Icon name="plus" size={16} /> {t('Column')}
        </button>
        <span className="grow" />
        {dirty && (
          <button className="btn btn-subtle" onClick={() => setCols(board.columns)}>
            {t('Discard')}
          </button>
        )}
        <button className="btn btn-primary" disabled={!dirty || cols.some((c) => !c.name.trim())} onClick={() => updateBoard({ columns: cols.map((c) => ({ ...c, name: c.name.trim() })) })}>
          {t('Save columns')}
        </button>
      </div>
    </div>
  );
}

function IssueTypes() {
  const { confirm } = useApp();
  const { board, issues, updateBoard } = useBoard();
  const [editing, setEditing] = useState<IssueType | null>(null);

  const save = (it: IssueType) => {
    const exists = board.issueTypes.some((x) => x.id === it.id);
    updateBoard({ issueTypes: exists ? board.issueTypes.map((x) => (x.id === it.id ? it : x)) : [...board.issueTypes, it] });
    setEditing(null);
  };
  const remove = async (it: IssueType) => {
    const used = issues.filter((i) => i.type === it.id).length;
    if (used) {
      await confirm({ title: t('Type "{name}" is in use', { name: it.name }), text: t('First change the type of the issues that use it ({n}).', { n: used }), confirmText: t('Got it') });
      return;
    }
    if (await confirm({ title: t('Delete type "{name}"?', { name: it.name }), confirmText: t('Delete'), danger: true })) updateBoard({ issueTypes: board.issueTypes.filter((x) => x.id !== it.id) });
  };

  return (
    <div className="panel">
      <div className="panel-title">{t('Issue types')}</div>
      <p className="muted small">{t('Each type can have a description template and a checklist — they are pre-filled when an issue is created.')}</p>
      <div className="type-list">
        {board.issueTypes.map((it) => (
          <div key={it.id} className="type-row">
            <TypeIcon type={it} size={20} />
            <b>{it.name}</b>
            {it.isEpic && <span className="lozenge lozenge-epic">{t('epic')}</span>}
            {it.template && <span className="muted small">{t('description template')}</span>}
            {!!it.checklist?.length && <span className="muted small">{t('checklist: {n}', { n: it.checklist.length })}</span>}
            <span className="grow" />
            <span className="muted small">{issuesCount(issues.filter((i) => i.type === it.id).length)}</span>
            <button className="icon-btn" onClick={() => setEditing(it)} aria-label={t('Edit')}>
              <Icon name="edit" size={16} />
            </button>
            <button className="icon-btn" onClick={() => remove(it)} aria-label={t('Delete')}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-subtle" onClick={() => setEditing({ id: 't-' + uid(6), name: '', icon: 'task', color: COLORS[0], template: '', checklist: [] })}>
          <Icon name="plus" size={16} /> {t('Issue type')}
        </button>
      </div>
      {editing && <TypeDialog type={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TypeDialog({ type, onSave, onClose }: { type: IssueType; onSave: (it: IssueType) => void; onClose: () => void }) {
  const [it, setIt] = useState<IssueType>(type);
  const [checklist, setChecklist] = useState((type.checklist ?? []).join('\n'));
  const canDiscard = useDiscardGuard();
  const dirty = JSON.stringify(it) !== JSON.stringify(type) || checklist !== (type.checklist ?? []).join('\n');
  const requestClose = async () => {
    if (await canDiscard(dirty)) onClose();
  };
  return (
    <Modal
      title={type.name ? t('Type "{name}"', { name: type.name }) : t('New issue type')}
      onClose={requestClose}
      size="md"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!it.name.trim()}
            onClick={() =>
              onSave({
                ...it,
                name: it.name.trim(),
                checklist: checklist
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            {t('Save')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t('Name *')}>
          <input className="input" autoFocus value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} />
        </Field>
        <Field label={t('Preview')}>
          <span className="type-preview">
            <TypeIcon type={it} size={24} /> {it.name || t('Type')}
          </span>
        </Field>
      </div>
      <Field label={t('Icon')}>
        <div className="emoji-grid">
          {Object.keys(TYPE_GLYPHS).map((k) => (
            <button key={k} type="button" className={cls('emoji-btn', it.icon === k && 'is-selected')} onClick={() => setIt({ ...it, icon: k })} title={k}>
              <TypeIcon type={{ ...it, icon: k }} size={20} />
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('Color')}>
        <div className="color-grid">
          {COLORS.map((c) => (
            <button key={c} type="button" className={cls('color-btn', it.color === c && 'is-selected')} style={{ background: c }} onClick={() => setIt({ ...it, color: c })} aria-label={c} />
          ))}
        </div>
      </Field>
      <label className="check-row">
        <input type="checkbox" checked={!!it.isEpic} onChange={(e) => setIt({ ...it, isEpic: e.target.checked })} />
        {t('This is an epic (a large goal that groups other issues)')}
      </label>
      <Field label={t('Description template')}>
        <MarkdownEditor value={it.template ?? ''} onChange={(v) => setIt({ ...it, template: v })} minRows={5} placeholder={t('For example: ### Steps to reproduce…')} />
      </Field>
      <Field label={t('Default checklist')} hint={t('One item per line')}>
        <textarea className="input" rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** Names typed in the panel → what is stored: trimmed, without empty entries, in a fixed key order. */
function cleanFieldNames(names: FieldNames): FieldNames {
  const out: FieldNames = {};
  for (const { key } of FIELDS) {
    const v = names[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/**
 * Field names: the template gives each kind of board its own names ("Milestone" in game dev,
 * "Month" at home); here admins rename any field. An empty box falls back to the template's name.
 */
function FieldNamesPanel() {
  const { board, updateBoard } = useBoard();
  const [names, setNames] = useState<FieldNames>(board.fieldNames);
  const stored = JSON.stringify(cleanFieldNames(board.fieldNames));
  const dirty = JSON.stringify(cleanFieldNames(names)) !== stored;
  const custom = Object.keys(cleanFieldNames(names)).length > 0;
  return (
    <div className="panel">
      <div className="panel-title">{t('Issue fields')}</div>
      <p className="muted small">{t('How the fields of an issue are called on this board. Each kind of board has its own names; type yours to rename a field, or leave the box empty to keep the name shown in grey.')}</p>
      <div className="field-names">
        <div className="field-names-row settings-row-head">
          <span>{t('Field')}</span>
          <span>{t('Name on this board')}</span>
          <span />
        </div>
        {FIELDS.map(({ key }) => {
          const value = names[key] ?? '';
          return (
            <div key={key} className="field-names-row">
              <label className="field-names-generic" htmlFor={`field-name-${key}`}>
                {key === 'details' ? t('Panel title') : genericFieldName(key)}
              </label>
              <input
                id={`field-name-${key}`}
                className="input"
                value={value}
                maxLength={MAX_FIELD_NAME}
                placeholder={defaultFieldName(board.template, key)}
                onChange={(e) => setNames({ ...names, [key]: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNames({ ...names, [key]: '' })}
                disabled={!value.trim()}
                title={t('Use the default name')}
                aria-label={t('Use the default name')}
              >
                <Icon name="history" size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="form-actions">
        {custom && (
          <button className="btn btn-subtle" onClick={() => setNames({})}>
            {t('Reset all')}
          </button>
        )}
        <span className="grow" />
        {dirty && (
          <button className="btn btn-subtle" onClick={() => setNames(board.fieldNames)}>
            {t('Discard')}
          </button>
        )}
        <button className="btn btn-primary" disabled={!dirty} onClick={() => updateBoard({ fieldNames: cleanFieldNames(names) })}>
          {t('Save names')}
        </button>
      </div>
    </div>
  );
}

function ListEditor({ title, hint, field, chips }: { title: string; hint: string; field: 'labels' | 'components'; chips?: boolean }) {
  const { board, updateBoard } = useBoard();
  const [v, setV] = useState('');
  const list = board[field];
  const add = () => {
    const items = v
      .split(',')
      .map((s) => (chips ? s.trim().replace(/\s+/g, '-') : s.trim()))
      .filter((s) => s && !list.includes(s));
    // "a, a" adds one item, not two.
    if (items.length) updateBoard({ [field]: [...list, ...new Set(items)] });
    setV('');
  };
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      <p className="muted small">{hint}</p>
      <div className="chips">
        {list.map((l) =>
          chips ? (
            <LabelChip key={l} text={l} onRemove={() => updateBoard({ [field]: list.filter((x) => x !== l) })} />
          ) : (
            <span key={l} className="chip chip-neutral">
              {l}
              <button className="chip-x" onClick={() => updateBoard({ [field]: list.filter((x) => x !== l) })} aria-label={t('Remove {name}', { name: l })}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ),
        )}
        {list.length === 0 && <span className="muted small">{t('Empty')}</span>}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder={t('Add (comma-separated is fine)')} />
        <button className="btn btn-subtle" disabled={!v.trim()}>
          <Icon name="plus" size={16} /> {t('Add')}
        </button>
      </form>
    </div>
  );
}

function ExportPanel() {
  const { user } = useApp();
  const { board, issues } = useBoard();
  return (
    <div className="panel">
      <div className="panel-title">{t('Export')}</div>
      <p className="muted small">{t('A JSON file with the board settings and all issues (without comments and members). You can import it on the Boards page — for example, to move a board out of demo mode.')}</p>
      <button className="btn btn-subtle" onClick={() => downloadJSON(`${board.key}-board.json`, exportBoard(board, issues, user.ghId))}>
        <Icon name="download" size={16} /> {t('Download JSON')}
      </button>
    </div>
  );
}

function DangerZone() {
  const { store, run, confirm } = useApp();
  const { board } = useBoard();
  const [typed, setTyped] = useState('');
  const del = async () => {
    const ok = await confirm({
      title: t('Delete board "{name}"?', { name: board.name }),
      text: t('All issues, comments and history will be deleted permanently. This cannot be undone.'),
      confirmText: t('Delete permanently'),
      danger: true,
    });
    if (!ok) return;
    navigate('/');
    await run(store.deleteBoard(board.id), t('Board deleted'));
  };
  return (
    <div className="panel panel-danger">
      <div className="panel-title">{t('Danger zone')}</div>
      <p className="muted small">
        {t('To delete the board, type its key')} <b>{board.key}</b>.
      </p>
      <div className="inline-form">
        <input className="input mono" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder={board.key} />
        <button className="btn btn-danger" disabled={typed !== board.key} onClick={del}>
          <Icon name="trash" size={16} /> {t('Delete board')}
        </button>
      </div>
    </div>
  );
}
