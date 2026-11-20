import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Comment, FieldKey, HistoryEntry, Issue, LinkType } from '../types';
import { useApp, useDiscardGuard } from '../app-context';
import { t } from '../i18n';
import { LINK_TYPES, epicOf, fieldLabel, inverseLink, isEpic, linkName, linkValue, renderHistoryValue } from '../lib/issues';
import { MAX_BUILD, fieldHint, fieldName, hasField } from '../lib/fields';
import { columnCategory, formatDateTime, rankBetween, timeAgo, uid, cls, isDone } from '../lib/utils';
import { BoardContext, useBoard } from './board-context';
import { Icon, TypeIcon } from './Icons';
import { ActionMenu, Avatar, InlineText, Modal, ProgressBar, Select, memberOf } from './ui';
import { MarkdownEditor, MarkdownView, toggleMarkdownTask } from './markdown';
import { CoverEditor } from './Cover';
import { AssigneePicker, ComponentsPicker, EpicPicker, LabelsPicker, PriorityPicker, StatusBadge, StatusPicker, TypePicker, VersionPicker } from './IssueFields';

/** Keep in sync with validIssue() in firestore.rules. */
const MAX_CHECKLIST = 200;

/**
 * Unsaved text in the dialog (description, comment and checklist drafts). Closing the dialog or
 * switching to another issue asks before such a draft is thrown away.
 */
const DraftsContext = createContext<(key: string, dirty: boolean) => void>(() => {});

function useDraft(key: string, dirty: boolean) {
  const report = useContext(DraftsContext);
  useEffect(() => {
    report(key, dirty);
    return () => report(key, false);
  }, [report, key, dirty]);
}

export function IssueDialog({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { store, user, run, confirm, toast } = useApp();
  const boardCtx = useBoard();
  const { board, issues, byId, perms, updateIssue, openIssue, newIssue } = boardCtx;
  const key = `${board.key}-${issue.number}`;
  const type = board.issueTypes.find((x) => x.id === issue.type);
  const epic = epicOf(board, byId, issue);
  const canEdit = perms.edit;
  const canDelete = perms.admin || (perms.edit && issue.createdBy === user.ghId);
  const set = (patch: Partial<Issue>) => updateIssue(issue, patch);
  const f = (k: FieldKey) => fieldName(board, k);

  const drafts = useRef(new Set<string>());
  const reportDraft = useCallback((k: string, dirty: boolean) => {
    if (dirty) drafts.current.add(k);
    else drafts.current.delete(k);
  }, []);
  const canDiscard = useDiscardGuard();
  const requestClose = async () => {
    if (await canDiscard(drafts.current.size > 0)) onClose();
  };
  const guardedOpen = useCallback(
    async (i: Issue) => {
      if (i.id === issue.id || (await canDiscard(drafts.current.size > 0))) openIssue(i);
    },
    [issue.id, canDiscard, openIssue],
  );
  // Links, epic children and other rows inside the dialog open issues through the guard too.
  const innerCtx = useMemo(() => ({ ...boardCtx, openIssue: guardedOpen }), [boardCtx, guardedOpen]);

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#/b/${board.id}?i=${issue.number}`;
    navigator.clipboard?.writeText(url).then(
      () => toast(t('Link copied'), 'success'),
      () => toast(url),
    );
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('Delete {key}?', { key }),
      text: t('The issue, its comments and history will be deleted permanently.'),
      confirmText: t('Delete'),
      danger: true,
    });
    if (!ok) return;
    // Remove references to this issue from other issues.
    const refs = issues.filter((i) => i.id !== issue.id && (i.epicId === issue.id || i.links?.some((l) => l.issueId === issue.id)));
    onClose();
    await run(async () => {
      await store.updateIssues(
        board.id,
        user,
        refs.map((r) => ({ id: r.id, patch: { epicId: r.epicId === issue.id ? null : r.epicId, links: (r.links ?? []).filter((l) => l.issueId !== issue.id) }, changes: [] })),
      );
      await store.deleteIssue(board.id, issue.id);
    }, t('{key} deleted', { key }));
  };

  const clone = async () => {
    const { id: _id, number: _n, createdAt: _c, updatedAt: _u, createdBy: _cb, ...rest } = issue;
    void _id;
    void _n;
    void _c;
    void _u;
    void _cb;
    // Right below the original: halfway to the next card of the column (a fixed +1 would leave
    // too little room for later moves between the two cards).
    const next = issues.filter((i) => i.status === issue.status && i.rank > issue.rank).reduce<number | undefined>((m, i) => (m === undefined || i.rank < m ? i.rank : m), undefined);
    const created = await run(
      store.createIssue(board.id, user, {
        ...rest,
        // Keep within the 500-character limit of firestore.rules.
        title: t('Copy: {title}', { title: issue.title }).slice(0, 500),
        links: [],
        reporterId: user.ghId,
        // The copy is resolved when it is created, not when the original was (progress charts count it by this date).
        resolvedAt: isDone(board, issue) ? Date.now() : null,
        rank: rankBetween(issue.rank, next),
        checklist: issue.checklist.map((c) => ({ ...c, id: uid(8) })),
      }),
    );
    if (created) {
      toast(t('Created {key}', { key: `${board.key}-${created.number}` }), 'success');
      guardedOpen(created);
    }
  };

  const header = (
    <div className="issue-head-crumbs">
      {epic && (
        <>
          <button className="crumb-link" onClick={() => guardedOpen(epic)}>
            <TypeIcon type={board.issueTypes.find((x) => x.id === epic.type)} size={14} />
            {board.key}-{epic.number}
          </button>
          <span className="muted">/</span>
        </>
      )}
      <span className="crumb-current">
        <TypeIcon type={type} size={14} />
        <button className="crumb-link" onClick={copyLink} title={t('Copy link')}>
          {key}
        </button>
      </span>
    </div>
  );

  return (
    <BoardContext.Provider value={innerCtx}>
      <DraftsContext.Provider value={reportDraft}>
        <Modal
          title={header}
          onClose={requestClose}
          size="xl"
          className="issue-modal"
          headerExtra={
            <>
              <button className="icon-btn" onClick={copyLink} title={t('Copy link')} aria-label={t('Copy link')}>
                <Icon name="link" size={18} />
              </button>
              <ActionMenu
                actions={[
                  { label: t('Clone'), icon: 'copy', onClick: clone, hidden: !canEdit },
                  { label: t('Add issue to epic'), icon: 'plus', onClick: () => newIssue({ epicId: issue.id }), hidden: !canEdit || !isEpic(board, issue) },
                  { label: t('Delete'), icon: 'trash', onClick: remove, danger: true, hidden: !canDelete },
                ]}
              />
            </>
          }
        >
          <div className="issue-grid">
            <div className="issue-main">
              <InlineText className="issue-title" value={issue.title} onSave={(v) => set({ title: v })} disabled={!canEdit} multiline maxLength={500} />
              <Description issue={issue} canEdit={canEdit} onSave={(d) => set({ description: d })} />
              <Checklist issue={issue} canEdit={canEdit} onChange={(c) => set({ checklist: c })} />
              {isEpic(board, issue) && <EpicChildren epic={issue} />}
              <Links issue={issue} canEdit={canEdit} />
              <Activity issue={issue} />
            </div>
            <aside className="issue-side">
              {hasField(board, 'cover') && <CoverEditor value={issue.cover} onChange={(cover) => set({ cover })} disabled={!canEdit} />}
              <div className="issue-status-row">
                <StatusPicker board={board} value={issue.status} onChange={(s) => set({ status: s })} disabled={!canEdit} />
                {isDone(board, issue) && (
                  <span className="resolved-mark">
                    <Icon name="check" size={14} /> {t('Resolved')}
                  </span>
                )}
              </div>
              <div className="details">
                <div className="details-title">{f('details')}</div>
                <Detail label={f('assigneeId')}>
                  <AssigneePicker board={board} value={issue.assigneeId} onChange={(v) => set({ assigneeId: v })} disabled={!canEdit} meId={user.ghId} />
                </Detail>
                <Detail label={f('reporterId')}>
                  <AssigneePicker board={board} value={issue.reporterId} onChange={(v) => v && set({ reporterId: v })} disabled={!canEdit} placeholder="—" />
                </Detail>
                <Detail label={f('priority')}>
                  <PriorityPicker board={board} value={issue.priority} onChange={(p) => set({ priority: p })} disabled={!canEdit} />
                </Detail>
                <Detail label={f('type')}>
                  {/* An epic is not part of another epic (as when an epic is created). */}
                  <TypePicker board={board} value={issue.type} onChange={(v) => set(isEpic(board, { type: v }) ? { type: v, epicId: null } : { type: v })} disabled={!canEdit} />
                </Detail>
                {hasField(board, 'releaseDate') && (
                  <Detail label={f('releaseDate')}>
                    <DateInput value={issue.releaseDate} onSave={(v) => set({ releaseDate: v })} disabled={!canEdit} />
                  </Detail>
                )}
                <Detail label={f('labels')}>
                  <LabelsPicker board={board} issues={issues} value={issue.labels} onChange={(l) => set({ labels: l })} disabled={!canEdit} />
                </Detail>
                <Detail label={f('components')}>
                  <ComponentsPicker board={board} value={issue.components} onChange={(c) => set({ components: c })} disabled={!canEdit} />
                </Detail>
                <Detail label={f('fixVersionId')}>
                  <VersionPicker board={board} value={issue.fixVersionId} onChange={(v) => set({ fixVersionId: v })} disabled={!canEdit} />
                </Detail>
                {hasField(board, 'build') && (
                  <Detail label={f('build')}>
                    <TextInput value={issue.build} onSave={(v) => set({ build: v })} disabled={!canEdit} placeholder={t('e.g. 0.4.2 (1234)')} maxLength={MAX_BUILD} />
                  </Detail>
                )}
                {!isEpic(board, issue) && (
                  <Detail label={f('epicId')}>
                    <EpicPicker board={board} issues={issues} value={issue.epicId} onChange={(v) => set({ epicId: v })} disabled={!canEdit} selfId={issue.id} />
                  </Detail>
                )}
                <Detail label={f('storyPoints')}>
                  <NumberInput value={issue.storyPoints} onSave={(v) => set({ storyPoints: v })} disabled={!canEdit} placeholder={fieldHint(board, 'storyPoints', '')} />
                </Detail>
                <Detail label={f('estimate')}>
                  <TextInput value={issue.estimate} onSave={(v) => set({ estimate: v })} disabled={!canEdit} placeholder={fieldHint(board, 'estimate', t('e.g. 3d 4h'))} />
                </Detail>
                <Detail label={f('dueDate')}>
                  <DateInput value={issue.dueDate} onSave={(v) => set({ dueDate: v })} disabled={!canEdit} />
                </Detail>
              </div>
              <div className="issue-dates muted small">
                <div>{t('Created {date}', { date: formatDateTime(issue.createdAt) })}</div>
                <div>{t('Updated {date}', { date: timeAgo(issue.updatedAt) })}</div>
                {issue.resolvedAt && <div>{t('Resolved {date}', { date: formatDateTime(issue.resolvedAt) })}</div>}
              </div>
            </aside>
          </div>
        </Modal>
      </DraftsContext.Provider>
    </BoardContext.Provider>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children}</div>
    </div>
  );
}

function NumberInput({ value, onSave, disabled, placeholder }: { value: number | null; onSave: (v: number | null) => void; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(value === null ? '' : String(value));
  useEffect(() => setV(value === null ? '' : String(value)), [value]);
  const commit = () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
    if (n !== null && isNaN(n)) return setV(value === null ? '' : String(value));
    if (n !== value) onSave(n);
  };
  return (
    <input
      className="input input-compact"
      inputMode="decimal"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      disabled={disabled}
      placeholder={placeholder || '—'}
    />
  );
}

function TextInput({ value, onSave, disabled, placeholder, maxLength = 50 }: { value: string; onSave: (v: string) => void; disabled?: boolean; placeholder?: string; maxLength?: number }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="input input-compact"
      value={v}
      onChange={(e) => setV(e.target.value)}
      maxLength={maxLength}
      onBlur={() => v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      disabled={disabled}
      placeholder={placeholder ?? '—'}
    />
  );
}

/**
 * Date field that saves only complete dates: typing a year digit by digit passes through values
 * like 0002-11-19, which must not each become a write and a history entry.
 */
function DateInput({ value, onSave, disabled }: { value: string | null; onSave: (v: string | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  return (
    <input
      className="input input-compact"
      type="date"
      value={v}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        const complete = next === '' || (/^\d{4}-\d{2}-\d{2}$/.test(next) && Number(next.slice(0, 4)) >= 1900);
        if (complete && (next || null) !== value) onSave(next || null);
      }}
      disabled={disabled}
    />
  );
}

// ---------------------------------------------------------------------------

function Description({ issue, canEdit, onSave }: { issue: Issue; canEdit: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(issue.description);
  useEffect(() => {
    if (!edit) setDraft(issue.description);
  }, [issue.description, edit]);
  useDraft('description', edit && draft !== issue.description);

  // The editor stays open until the text is saved, so a rejected save (for example, the device
  // clock is far off and the history entry is refused) does not lose it.
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEdit(false);
  };

  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>{t('Description')}</h3>
        {canEdit && !edit && (
          <button className="btn btn-subtle btn-sm" onClick={() => setEdit(true)}>
            <Icon name="edit" size={14} /> {t('Edit')}
          </button>
        )}
      </div>
      {edit ? (
        <>
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            autoFocus
            minRows={8}
            maxLength={100_000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
            }}
          />
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {t('Save')}
            </button>
            <button
              className="btn btn-subtle"
              onClick={() => {
                setDraft(issue.description);
                setEdit(false);
              }}
            >
              {t('Cancel')}
            </button>
            <span className="muted small">{t('Ctrl+Enter to save')}</span>
          </div>
        </>
      ) : issue.description.trim() ? (
        <div className={cls('description-view', canEdit && 'is-editable')} onDoubleClick={() => canEdit && setEdit(true)}>
          <MarkdownView source={issue.description} onToggleTask={canEdit ? (idx) => onSave(toggleMarkdownTask(issue.description, idx)) : undefined} />
        </div>
      ) : (
        <div className={cls('description-empty', canEdit && 'is-editable')} onClick={() => canEdit && setEdit(true)}>
          {canEdit ? t('Add a description…') : t('No description')}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Checklist({ issue, canEdit, onChange }: { issue: Issue; canEdit: boolean; onChange: (c: Issue['checklist']) => void }) {
  const { toast } = useApp();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  useDraft('checklist', text.trim() !== '');
  const items = issue.checklist;
  const done = items.filter((i) => i.done).length;
  if (!items.length && !canEdit) return null;

  const add = () => {
    const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const room = MAX_CHECKLIST - items.length;
    if (lines.length > room) toast(t('A checklist holds up to {n} items', { n: MAX_CHECKLIST }), 'error');
    if (room <= 0) return;
    onChange([...items, ...lines.slice(0, room).map((v) => ({ id: uid(8), text: v, done: false }))]);
    setText('');
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>
          {t('Checklist')}{' '}
          {items.length > 0 && (
            <span className="muted small">
              {done}/{items.length}
            </span>
          )}
        </h3>
        {canEdit && !adding && (
          <button className="btn btn-subtle btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> {t('Item')}
          </button>
        )}
      </div>
      {items.length > 0 && <ProgressBar done={done} progress={0} total={items.length} />}
      <ul className="checklist">
        {items.map((c, idx) => (
          <li key={c.id} className={cls('checklist-item', c.done && 'is-done')}>
            <input type="checkbox" checked={c.done} disabled={!canEdit} onChange={() => onChange(items.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} aria-label={c.text} />
            <InlineText className="checklist-text" value={c.text} disabled={!canEdit} onSave={(v) => onChange(items.map((x) => (x.id === c.id ? { ...x, text: v } : x)))} />
            {canEdit && (
              <span className="row-actions">
                <button className="icon-btn" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={t('Move up')}>
                  <Icon name="arrowUp" size={14} />
                </button>
                <button className="icon-btn" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label={t('Move down')}>
                  <Icon name="arrowDown" size={14} />
                </button>
                <button className="icon-btn" onClick={() => onChange(items.filter((x) => x.id !== c.id))} aria-label={t('Delete item')}>
                  <Icon name="trash" size={14} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (adding || items.length === 0) && (
        <div className="checklist-add">
          <textarea
            className="input"
            rows={1}
            value={text}
            autoFocus={adding}
            placeholder={t('New item (you can paste several lines)')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                add();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                setAdding(false);
                setText('');
              }
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!text.trim()}>
            {t('Add')}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function EpicChildren({ epic }: { epic: Issue }) {
  const { board, issues, perms, openIssue, newIssue } = useBoard();
  const children = issues.filter((i) => i.epicId === epic.id).sort((a, b) => a.rank - b.rank);
  const done = children.filter((c) => columnCategory(board, c.status) === 'done').length;
  const prog = children.filter((c) => columnCategory(board, c.status) === 'progress').length;
  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>
          {t('Issues in this epic')} <span className="muted small">{children.length}</span>
        </h3>
        {perms.edit && (
          <button className="btn btn-subtle btn-sm" onClick={() => newIssue({ epicId: epic.id })}>
            <Icon name="plus" size={14} /> {t('Issue')}
          </button>
        )}
      </div>
      {children.length > 0 && <ProgressBar done={done} progress={prog} total={children.length} />}
      <div className="issue-rows">
        {children.map((c) => (
          <IssueRow key={c.id} issue={c} onOpen={() => openIssue(c)} />
        ))}
        {children.length === 0 && <div className="muted small">{t('No issues in this epic yet')}</div>}
      </div>
    </section>
  );
}

function IssueRow({ issue, onOpen, extra }: { issue: Issue; onOpen: () => void; extra?: React.ReactNode }) {
  const { board } = useBoard();
  return (
    <div className="issue-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <TypeIcon type={board.issueTypes.find((x) => x.id === issue.type)} />
      <span className={cls('issue-row-key', isDone(board, issue) && 'is-done')}>
        {board.key}-{issue.number}
      </span>
      <span className="issue-row-title">{issue.title}</span>
      <Avatar info={memberOf(board, issue.assigneeId)} size={20} />
      <StatusBadge board={board} status={issue.status} />
      {extra}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Links({ issue, canEdit }: { issue: Issue; canEdit: boolean }) {
  const { store, user, run } = useApp();
  const { board, issues, byId, openIssue } = useBoard();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<LinkType>('relates');
  const [target, setTarget] = useState<string | null>(null);
  const links = (issue.links ?? []).filter((l) => byId.has(l.issueId));
  if (!links.length && !canEdit) return null;

  /** Adds or removes a link on both issues (with the inverse type on the other side). */
  const write = async (a: Issue, b: Issue, linkType: LinkType, add: boolean) => {
    const inv = inverseLink(linkType);
    const la = add ? [...(a.links ?? []).filter((l) => l.issueId !== b.id), { type: linkType, issueId: b.id }] : (a.links ?? []).filter((l) => !(l.issueId === b.id && l.type === linkType));
    const lb = add ? [...(b.links ?? []).filter((l) => l.issueId !== a.id), { type: inv, issueId: a.id }] : (b.links ?? []).filter((l) => !(l.issueId === a.id && l.type === inv));
    const va = linkValue(linkType, `${board.key}-${b.number}`);
    const vb = linkValue(inv, `${board.key}-${a.number}`);
    // Both sides in one write, so a link never ends up on just one of the two issues.
    await run(
      store.updateIssues(board.id, user, [
        { id: a.id, patch: { links: la }, changes: [{ field: 'links', from: add ? '' : va, to: add ? va : '' }] },
        { id: b.id, patch: { links: lb }, changes: [{ field: 'links', from: add ? '' : vb, to: add ? vb : '' }] },
      ]),
    );
  };

  const grouped = LINK_TYPES.map((lt) => ({ ...lt, items: links.filter((l) => l.type === lt.id) })).filter((g) => g.items.length);

  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>{t('Linked issues')}</h3>
        {canEdit && !adding && (
          <button className="btn btn-subtle btn-sm" onClick={() => setAdding(true)}>
            <Icon name="link" size={14} /> {t('Link')}
          </button>
        )}
      </div>
      {grouped.map((g) => (
        <div key={g.id} className="link-group">
          <div className="link-group-name muted small">{linkName(g.id)}</div>
          <div className="issue-rows">
            {g.items.map((l) => {
              const other = byId.get(l.issueId)!;
              return (
                <IssueRow
                  key={l.issueId + l.type}
                  issue={other}
                  onOpen={() => openIssue(other)}
                  extra={
                    canEdit && (
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          write(issue, other, l.type, false);
                        }}
                        aria-label={t('Remove link')}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
      {!links.length && !adding && <div className="muted small">{t('No links')}</div>}
      {adding && (
        <div className="link-add">
          <Select options={LINK_TYPES.map((l) => ({ value: l.id, label: linkName(l.id) }))} value={type} onChange={(v) => v && setType(v as LinkType)} width={200} />
          <Select
            className="grow"
            searchable
            placeholder={t('Choose an issue')}
            options={issues
              .filter((i) => i.id !== issue.id)
              .sort((a, b) => b.number - a.number)
              .map((i) => ({ value: i.id, label: i.title, hint: `${board.key}-${i.number}`, icon: <TypeIcon type={board.issueTypes.find((x) => x.id === i.type)} /> }))}
            value={target}
            onChange={(v) => setTarget((v as string) ?? null)}
            width={380}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={!target}
            onClick={async () => {
              const other = target ? byId.get(target) : undefined;
              if (other) await write(issue, other, type, true);
              setAdding(false);
              setTarget(null);
            }}
          >
            {t('Link')}
          </button>
          <button className="btn btn-subtle btn-sm" onClick={() => (setAdding(false), setTarget(null))}>
            {t('Cancel')}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Activity({ issue }: { issue: Issue }) {
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>{t('Activity')}</h3>
        <div className="seg">
          <button className={cls(tab === 'comments' && 'is-active')} onClick={() => setTab('comments')}>
            <Icon name="comment" size={14} /> {t('Comments')}
          </button>
          <button className={cls(tab === 'history' && 'is-active')} onClick={() => setTab('history')}>
            <Icon name="history" size={14} /> {t('History')}
          </button>
        </div>
      </div>
      {tab === 'comments' ? <Comments issue={issue} /> : <History issue={issue} />}
    </section>
  );
}

function Comments({ issue }: { issue: Issue }) {
  const { store, user, run, confirm, toast } = useApp();
  const { board, perms } = useBoard();
  const [list, setList] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  useDraft('comment', draft.trim() !== '');
  useDraft('comment-edit', editing !== null && editText !== (list?.find((c) => c.id === editing)?.body ?? ''));

  useEffect(() => store.subscribeComments(board.id, issue.id, setList, (e) => toast(e.message, 'error')), [store, board.id, issue.id, toast]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setFocused(false);
    // A rejected comment (for example, the device clock is far off) gives its text back, unless a new one was started.
    const ok = await run(store.addComment(board.id, issue.id, user, body).then(() => true));
    if (!ok) {
      setDraft((d) => d || body);
      setFocused(true);
    }
  };

  // The editor stays open until the edit is saved, so a rejected edit does not lose the text.
  const saveEdit = async (c: Comment) => {
    const body = editText.trim();
    if (!body) return;
    // Unchanged text: nothing to save, and the comment does not get an "edited" mark.
    if (body === c.body) return setEditing(null);
    setSavingEdit(true);
    const ok = await run(store.updateComment(board.id, issue.id, c.id, body).then(() => true));
    setSavingEdit(false);
    if (ok) setEditing((e) => (e === c.id ? null : e));
  };

  const sorted = useMemo(() => [...(list ?? [])].sort((a, b) => b.createdAt - a.createdAt), [list]);

  return (
    <div className="comments">
      {perms.comment && (
        <div className="comment-new">
          <Avatar info={user} size={32} />
          <div className="grow">
            {focused || draft ? (
              <>
                <MarkdownEditor
                  value={draft}
                  onChange={setDraft}
                  autoFocus
                  minRows={3}
                  maxLength={20_000}
                  placeholder={t('Add a comment… (Ctrl+Enter to send)')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
                  }}
                />
                <div className="form-actions">
                  <button className="btn btn-primary btn-sm" onClick={send} disabled={!draft.trim()}>
                    {t('Save')}
                  </button>
                  <button className="btn btn-subtle btn-sm" onClick={() => (setDraft(''), setFocused(false))}>
                    {t('Cancel')}
                  </button>
                </div>
              </>
            ) : (
              <button className="comment-placeholder" onClick={() => setFocused(true)}>
                {t('Add a comment…')}
              </button>
            )}
          </div>
        </div>
      )}
      {list === null && <div className="muted small">{t('Loading…')}</div>}
      {list && list.length === 0 && <div className="muted small">{t('No comments yet')}</div>}
      {sorted.map((c) => {
        const author = memberOf(board, c.authorId);
        const mine = c.authorId === user.ghId;
        return (
          <div key={c.id} className="comment">
            <Avatar info={author} size={32} />
            <div className="comment-body">
              <div className="comment-head">
                <b>{author?.name}</b>
                <span className="muted small" title={formatDateTime(c.createdAt)}>
                  {timeAgo(c.createdAt)}
                  {c.editedAt && ` · ${t('edited')}`}
                </span>
              </div>
              {editing === c.id ? (
                <>
                  <MarkdownEditor value={editText} onChange={setEditText} autoFocus minRows={3} maxLength={20_000} />
                  <div className="form-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(c)} disabled={!editText.trim() || savingEdit}>
                      {t('Save')}
                    </button>
                    <button className="btn btn-subtle btn-sm" onClick={() => setEditing(null)}>
                      {t('Cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <MarkdownView source={c.body} />
                  <div className="comment-actions">
                    {mine && perms.comment && (
                      <button
                        className="btn btn-link btn-sm"
                        onClick={() => {
                          setEditing(c.id);
                          setEditText(c.body);
                        }}
                      >
                        {t('Edit')}
                      </button>
                    )}
                    {((mine && perms.comment) || perms.admin) && (
                      <button
                        className="btn btn-link btn-sm"
                        onClick={async () => {
                          if (await confirm({ title: t('Delete comment?'), confirmText: t('Delete'), danger: true })) run(store.deleteComment(board.id, issue.id, c.id));
                        }}
                      >
                        {t('Delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function History({ issue }: { issue: Issue }) {
  const { store, toast } = useApp();
  const { board } = useBoard();
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  useEffect(() => store.subscribeHistory(board.id, issue.id, setList, (e) => toast(e.message, 'error')), [store, board.id, issue.id, toast]);
  const sorted = [...(list ?? [])].sort((a, b) => b.at - a.at);
  const creator = memberOf(board, issue.createdBy);
  return (
    <div className="history">
      {sorted.map((h) => {
        const actor = memberOf(board, h.actorId);
        return (
          <div key={h.id} className="history-item">
            <Avatar info={actor} size={28} />
            <div className="grow">
              <div>
                <b>{actor?.name}</b> <span className="muted small">{timeAgo(h.at)}</span>
              </div>
              {h.changes.map((c, i) => (
                <div key={i} className="history-change">
                  <span className="history-field">{fieldLabel(board, c.field)}</span>
                  {c.field === 'description' ? (
                    <span className="muted">{t('changed')}</span>
                  ) : c.field === 'links' ? (
                    // Link entries have only one side: added (to) or removed (from).
                    c.to ? <span className="history-to">{renderHistoryValue(board, c.field, c.to)}</span> : <span className="history-from">{renderHistoryValue(board, c.field, c.from)}</span>
                  ) : (
                    <>
                      <span className="history-from">{renderHistoryValue(board, c.field, c.from)}</span>
                      <span className="muted">→</span>
                      <span className="history-to">{renderHistoryValue(board, c.field, c.to)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="history-item">
        <Avatar info={creator} size={28} />
        <div className="grow">
          <div>
            <b>{creator?.name}</b> {t('created the issue')} <span className="muted small">{formatDateTime(issue.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
