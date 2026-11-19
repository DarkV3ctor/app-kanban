import { useEffect, useMemo, useState } from 'react';
import type { Comment, HistoryEntry, Issue, LinkType } from '../types';
import { useApp } from '../app-context';
import { LINK_TYPES, inverseLink, isEpic, linkName } from '../lib/issues';
import { columnCategory, formatDateTime, timeAgo, uid, cls, isDone } from '../lib/utils';
import { useBoard } from './board-context';
import { Icon, TypeIcon } from './Icons';
import { ActionMenu, Avatar, InlineText, MarkdownEditor, MarkdownView, Modal, ProgressBar, Select, memberOf, toggleMarkdownTask } from './ui';
import { AssigneePicker, ComponentsPicker, EpicPicker, LabelsPicker, PriorityPicker, StatusBadge, StatusPicker, TypePicker, VersionPicker } from './IssueFields';

export function IssueDialog({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { store, user, run, confirm, toast } = useApp();
  const { board, issues, byId, perms, updateIssue, openIssue, newIssue } = useBoard();
  const key = `${board.key}-${issue.number}`;
  const type = board.issueTypes.find((t) => t.id === issue.type);
  const epic = issue.epicId ? byId.get(issue.epicId) : undefined;
  const canEdit = perms.edit;
  const canDelete = perms.admin || (perms.edit && issue.createdBy === user.ghId);
  const set = (patch: Partial<Issue>) => updateIssue(issue, patch);

  const copyLink = () => {
    const url = `${location.origin}${location.pathname}#/b/${board.id}?i=${issue.number}`;
    navigator.clipboard?.writeText(url).then(
      () => toast('Ссылка скопирована', 'success'),
      () => toast(url),
    );
  };

  const remove = async () => {
    const ok = await confirm({ title: `Удалить ${key}?`, text: 'Задача, её комментарии и история будут удалены без возможности восстановления.', confirmText: 'Удалить', danger: true });
    if (!ok) return;
    // чистим ссылки на эту задачу у других
    const refs = issues.filter((i) => i.id !== issue.id && (i.epicId === issue.id || i.links?.some((l) => l.issueId === issue.id)));
    onClose();
    await run(async () => {
      for (const r of refs) {
        await store.updateIssue(board.id, r.id, { epicId: r.epicId === issue.id ? null : r.epicId, links: (r.links ?? []).filter((l) => l.issueId !== issue.id) }, user, []);
      }
      await store.deleteIssue(board.id, issue.id);
    }, `${key} удалена`);
  };

  const clone = async () => {
    const { id: _id, number: _n, createdAt: _c, updatedAt: _u, createdBy: _cb, ...rest } = issue;
    void _id;
    void _n;
    void _c;
    void _u;
    void _cb;
    const created = await run(
      store.createIssue(board.id, user, { ...rest, title: `Копия: ${issue.title}`, links: [], reporterId: user.ghId, rank: issue.rank + 1, checklist: issue.checklist.map((c) => ({ ...c, id: uid(8) })) }),
    );
    if (created) {
      toast(`Создана ${board.key}-${created.number}`, 'success');
      openIssue(created);
    }
  };

  const header = (
    <div className="issue-head-crumbs">
      {epic && (
        <>
          <button className="crumb-link" onClick={() => openIssue(epic)}>
            <TypeIcon type={board.issueTypes.find((t) => t.id === epic.type)} size={14} />
            {board.key}-{epic.number}
          </button>
          <span className="muted">/</span>
        </>
      )}
      <span className="crumb-current">
        <TypeIcon type={type} size={14} />
        <button className="crumb-link" onClick={copyLink} title="Скопировать ссылку">
          {key}
        </button>
      </span>
    </div>
  );

  return (
    <Modal
      title={header}
      onClose={onClose}
      size="xl"
      className="issue-modal"
      headerExtra={
        <>
          <button className="icon-btn" onClick={copyLink} title="Скопировать ссылку" aria-label="Скопировать ссылку">
            <Icon name="link" size={18} />
          </button>
          <ActionMenu
            actions={[
              { label: 'Клонировать', icon: 'copy', onClick: clone, hidden: !canEdit },
              { label: 'Создать подзадачу эпика', icon: 'plus', onClick: () => newIssue({ epicId: issue.id }), hidden: !canEdit || !isEpic(board, issue) },
              { label: 'Удалить', icon: 'trash', onClick: remove, danger: true, hidden: !canDelete },
            ]}
          />
        </>
      }
    >
      <div className="issue-grid">
        <div className="issue-main">
          <InlineText className="issue-title" value={issue.title} onSave={(t) => set({ title: t })} disabled={!canEdit} multiline />
          <Description issue={issue} canEdit={canEdit} onSave={(d) => set({ description: d })} />
          <Checklist issue={issue} canEdit={canEdit} onChange={(c) => set({ checklist: c })} />
          {isEpic(board, issue) && <EpicChildren epic={issue} />}
          <Links issue={issue} canEdit={canEdit} />
          <Activity issue={issue} />
        </div>
        <aside className="issue-side">
          <div className="issue-status-row">
            <StatusPicker board={board} value={issue.status} onChange={(s) => set({ status: s })} disabled={!canEdit} />
            {isDone(board, issue) && <span className="resolved-mark"><Icon name="check" size={14} /> Решена</span>}
          </div>
          <div className="details">
            <div className="details-title">Сведения</div>
            <Detail label="Исполнитель">
              <AssigneePicker board={board} value={issue.assigneeId} onChange={(v) => set({ assigneeId: v })} disabled={!canEdit} meId={user.ghId} />
            </Detail>
            <Detail label="Автор">
              <AssigneePicker board={board} value={issue.reporterId} onChange={(v) => v && set({ reporterId: v })} disabled={!canEdit} placeholder="—" />
            </Detail>
            <Detail label="Приоритет">
              <PriorityPicker value={issue.priority} onChange={(p) => set({ priority: p })} disabled={!canEdit} />
            </Detail>
            <Detail label="Тип">
              <TypePicker board={board} value={issue.type} onChange={(t) => set({ type: t })} disabled={!canEdit} />
            </Detail>
            <Detail label="Метки">
              <LabelsPicker board={board} issues={issues} value={issue.labels} onChange={(l) => set({ labels: l })} disabled={!canEdit} />
            </Detail>
            <Detail label="Компоненты">
              <ComponentsPicker board={board} value={issue.components} onChange={(c) => set({ components: c })} disabled={!canEdit} />
            </Detail>
            <Detail label="Версия">
              <VersionPicker board={board} value={issue.fixVersionId} onChange={(v) => set({ fixVersionId: v })} disabled={!canEdit} />
            </Detail>
            {!isEpic(board, issue) && (
              <Detail label="Эпик">
                <EpicPicker board={board} issues={issues} value={issue.epicId} onChange={(v) => set({ epicId: v })} disabled={!canEdit} selfId={issue.id} />
              </Detail>
            )}
            <Detail label="Story points">
              <NumberInput value={issue.storyPoints} onSave={(v) => set({ storyPoints: v })} disabled={!canEdit} />
            </Detail>
            <Detail label="Оценка">
              <TextInput value={issue.estimate} onSave={(v) => set({ estimate: v })} disabled={!canEdit} placeholder="напр. 3d 4h" />
            </Detail>
            <Detail label="Срок">
              <input className="input input-compact" type="date" value={issue.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} disabled={!canEdit} />
            </Detail>
          </div>
          <div className="issue-dates muted small">
            <div>Создано {formatDateTime(issue.createdAt)}</div>
            <div>Обновлено {timeAgo(issue.updatedAt)}</div>
            {issue.resolvedAt && <div>Решено {formatDateTime(issue.resolvedAt)}</div>}
          </div>
        </aside>
      </div>
    </Modal>
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

function NumberInput({ value, onSave, disabled }: { value: number | null; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value === null ? '' : String(value));
  useEffect(() => setV(value === null ? '' : String(value)), [value]);
  const commit = () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
    if (n !== null && isNaN(n)) return setV(value === null ? '' : String(value));
    if (n !== value) onSave(n);
  };
  return <input className="input input-compact" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} disabled={disabled} placeholder="—" />;
}

function TextInput({ value, onSave, disabled, placeholder }: { value: string; onSave: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="input input-compact"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      disabled={disabled}
      placeholder={placeholder ?? '—'}
    />
  );
}

// ---------------------------------------------------------------------------

function Description({ issue, canEdit, onSave }: { issue: Issue; canEdit: boolean; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(issue.description);
  useEffect(() => {
    if (!edit) setDraft(issue.description);
  }, [issue.description, edit]);

  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>Описание</h3>
        {canEdit && !edit && (
          <button className="btn btn-subtle btn-sm" onClick={() => setEdit(true)}>
            <Icon name="edit" size={14} /> Изменить
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onSave(draft);
                setEdit(false);
              }
            }}
          />
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(draft);
                setEdit(false);
              }}
            >
              Сохранить
            </button>
            <button
              className="btn btn-subtle"
              onClick={() => {
                setDraft(issue.description);
                setEdit(false);
              }}
            >
              Отмена
            </button>
            <span className="muted small">Ctrl+Enter — сохранить</span>
          </div>
        </>
      ) : issue.description.trim() ? (
        <div className={cls('description-view', canEdit && 'is-editable')} onDoubleClick={() => canEdit && setEdit(true)}>
          <MarkdownView source={issue.description} onToggleTask={canEdit ? (idx) => onSave(toggleMarkdownTask(issue.description, idx)) : undefined} />
        </div>
      ) : (
        <div className={cls('description-empty', canEdit && 'is-editable')} onClick={() => canEdit && setEdit(true)}>
          {canEdit ? 'Добавьте описание…' : 'Нет описания'}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Checklist({ issue, canEdit, onChange }: { issue: Issue; canEdit: boolean; onChange: (c: Issue['checklist']) => void }) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const items = issue.checklist;
  const done = items.filter((i) => i.done).length;
  if (!items.length && !canEdit) return null;

  const add = () => {
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    onChange([...items, ...lines.map((t) => ({ id: uid(8), text: t, done: false }))]);
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
          Чек-лист {items.length > 0 && <span className="muted small">{done}/{items.length}</span>}
        </h3>
        {canEdit && !adding && (
          <button className="btn btn-subtle btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Пункт
          </button>
        )}
      </div>
      {items.length > 0 && <ProgressBar done={done} progress={0} total={items.length} />}
      <ul className="checklist">
        {items.map((c, idx) => (
          <li key={c.id} className={cls('checklist-item', c.done && 'is-done')}>
            <input type="checkbox" checked={c.done} disabled={!canEdit} onChange={() => onChange(items.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} aria-label={c.text} />
            <InlineText className="checklist-text" value={c.text} disabled={!canEdit} onSave={(t) => onChange(items.map((x) => (x.id === c.id ? { ...x, text: t } : x)))} />
            {canEdit && (
              <span className="row-actions">
                <button className="icon-btn" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Выше">
                  <Icon name="arrowUp" size={14} />
                </button>
                <button className="icon-btn" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Ниже">
                  <Icon name="arrowDown" size={14} />
                </button>
                <button className="icon-btn" onClick={() => onChange(items.filter((x) => x.id !== c.id))} aria-label="Удалить пункт">
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
            placeholder="Новый пункт (можно вставить несколько строк)"
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
            Добавить
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
          Задачи эпика <span className="muted small">{children.length}</span>
        </h3>
        {perms.edit && (
          <button className="btn btn-subtle btn-sm" onClick={() => newIssue({ epicId: epic.id })}>
            <Icon name="plus" size={14} /> Задача
          </button>
        )}
      </div>
      {children.length > 0 && <ProgressBar done={done} progress={prog} total={children.length} />}
      <div className="issue-rows">
        {children.map((c) => (
          <IssueRow key={c.id} issue={c} onOpen={() => openIssue(c)} />
        ))}
        {children.length === 0 && <div className="muted small">В эпике пока нет задач</div>}
      </div>
    </section>
  );
}

function IssueRow({ issue, onOpen, extra }: { issue: Issue; onOpen: () => void; extra?: React.ReactNode }) {
  const { board } = useBoard();
  return (
    <div className="issue-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <TypeIcon type={board.issueTypes.find((t) => t.id === issue.type)} />
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

  const write = async (a: Issue, b: Issue, t: LinkType, add: boolean) => {
    const inv = inverseLink(t);
    const la = add ? [...(a.links ?? []).filter((l) => l.issueId !== b.id), { type: t, issueId: b.id }] : (a.links ?? []).filter((l) => !(l.issueId === b.id && l.type === t));
    const lb = add ? [...(b.links ?? []).filter((l) => l.issueId !== a.id), { type: inv, issueId: a.id }] : (b.links ?? []).filter((l) => !(l.issueId === a.id && l.type === inv));
    const ka = `${board.key}-${a.number}`;
    const kb = `${board.key}-${b.number}`;
    await run(async () => {
      await store.updateIssue(board.id, a.id, { links: la }, user, [{ field: 'Связи', from: add ? '' : `${linkName(t)} ${kb}`, to: add ? `${linkName(t)} ${kb}` : '' }]);
      await store.updateIssue(board.id, b.id, { links: lb }, user, [{ field: 'Связи', from: add ? '' : `${linkName(inv)} ${ka}`, to: add ? `${linkName(inv)} ${ka}` : '' }]);
    });
  };

  const grouped = LINK_TYPES.map((lt) => ({ ...lt, items: links.filter((l) => l.type === lt.id) })).filter((g) => g.items.length);

  return (
    <section className="issue-section">
      <div className="section-head">
        <h3>Связанные задачи</h3>
        {canEdit && !adding && (
          <button className="btn btn-subtle btn-sm" onClick={() => setAdding(true)}>
            <Icon name="link" size={14} /> Связать
          </button>
        )}
      </div>
      {grouped.map((g) => (
        <div key={g.id} className="link-group">
          <div className="link-group-name muted small">{g.name}</div>
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
                        aria-label="Удалить связь"
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
      {!links.length && !adding && <div className="muted small">Нет связей</div>}
      {adding && (
        <div className="link-add">
          <Select options={LINK_TYPES.map((l) => ({ value: l.id, label: l.name }))} value={type} onChange={(v) => v && setType(v as LinkType)} width={200} />
          <Select
            className="grow"
            searchable
            placeholder="Выберите задачу"
            options={issues.filter((i) => i.id !== issue.id).sort((a, b) => b.number - a.number).map((i) => ({ value: i.id, label: i.title, hint: `${board.key}-${i.number}`, icon: <TypeIcon type={board.issueTypes.find((t) => t.id === i.type)} /> }))}
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
            Связать
          </button>
          <button className="btn btn-subtle btn-sm" onClick={() => (setAdding(false), setTarget(null))}>
            Отмена
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
        <h3>Активность</h3>
        <div className="seg">
          <button className={cls(tab === 'comments' && 'is-active')} onClick={() => setTab('comments')}>
            <Icon name="comment" size={14} /> Комментарии
          </button>
          <button className={cls(tab === 'history' && 'is-active')} onClick={() => setTab('history')}>
            <Icon name="history" size={14} /> История
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

  useEffect(() => store.subscribeComments(board.id, issue.id, setList, (e) => toast(e.message, 'error')), [store, board.id, issue.id, toast]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setFocused(false);
    await run(store.addComment(board.id, issue.id, user, body));
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
                  placeholder="Добавьте комментарий… (Ctrl+Enter — отправить)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
                  }}
                />
                <div className="form-actions">
                  <button className="btn btn-primary btn-sm" onClick={send} disabled={!draft.trim()}>
                    Сохранить
                  </button>
                  <button className="btn btn-subtle btn-sm" onClick={() => (setDraft(''), setFocused(false))}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <button className="comment-placeholder" onClick={() => setFocused(true)}>
                Добавьте комментарий…
              </button>
            )}
          </div>
        </div>
      )}
      {list === null && <div className="muted small">Загрузка…</div>}
      {list && list.length === 0 && <div className="muted small">Комментариев пока нет</div>}
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
                  {c.editedAt && ' · изменён'}
                </span>
              </div>
              {editing === c.id ? (
                <>
                  <MarkdownEditor value={editText} onChange={setEditText} autoFocus minRows={3} />
                  <div className="form-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        setEditing(null);
                        await run(store.updateComment(board.id, issue.id, c.id, editText.trim()));
                      }}
                      disabled={!editText.trim()}
                    >
                      Сохранить
                    </button>
                    <button className="btn btn-subtle btn-sm" onClick={() => setEditing(null)}>
                      Отмена
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
                        Изменить
                      </button>
                    )}
                    {((mine && perms.comment) || perms.admin) && (
                      <button
                        className="btn btn-link btn-sm"
                        onClick={async () => {
                          if (await confirm({ title: 'Удалить комментарий?', confirmText: 'Удалить', danger: true })) run(store.deleteComment(board.id, issue.id, c.id));
                        }}
                      >
                        Удалить
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
                  <span className="history-field">{c.field}</span>
                  {c.field === 'Описание' ? (
                    <span className="muted">изменено</span>
                  ) : (
                    <>
                      {c.from && <span className="history-from">{c.from}</span>}
                      {c.from && c.to && <span className="muted">→</span>}
                      {c.to && <span className="history-to">{c.to}</span>}
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
            <b>{creator?.name}</b> создал(а) задачу <span className="muted small">{formatDateTime(issue.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

