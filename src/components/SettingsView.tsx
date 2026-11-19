import { useEffect, useState } from 'react';
import type { Column, ColumnCategory, IssueType } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { exportBoard } from '../lib/issues';
import { downloadJSON, sanitizeKey, uid, cls } from '../lib/utils';
import { newColumnId } from '../templates';
import { useBoard } from './board-context';
import { Icon, TYPE_GLYPHS, TypeIcon } from './Icons';
import { Field, LabelChip, MarkdownEditor, Modal, Select } from './ui';

const CATEGORIES: { value: ColumnCategory; label: string }[] = [
  { value: 'todo', label: 'К выполнению' },
  { value: 'progress', label: 'В работе' },
  { value: 'done', label: 'Готово' },
];

const COLORS = ['#1D7AFC', '#22A06B', '#E2483D', '#E56910', '#B38600', '#904EE2', '#6E5DC6', '#CD519D', '#1D9AAA', '#626F86'];
const EMOJIS = ['🎮', '🏠', '💻', '📋', '🚀', '🎨', '🎵', '🧩', '🗺️', '🛒', '💰', '❤️', '📚', '🌱', '🚗', '🐾', '✈️', '🏋️', '🎯', '⭐'];

export function SettingsView() {
  const { perms } = useBoard();
  if (!perms.admin) {
    return (
      <div className="settings-view">
        <div className="view-head">
          <h1>Настройки</h1>
        </div>
        <div className="alert alert-info">
          <Icon name="shield" size={16} /> Настройки доски доступны администраторам и владельцу. Ваша роль позволяет только {perms.edit ? 'работать с задачами' : perms.comment ? 'просматривать и комментировать' : 'просматривать'}.
        </div>
        <BoardSummary />
        <ExportPanel />
      </div>
    );
  }
  return (
    <div className="settings-view">
      <div className="view-head">
        <h1>Настройки доски</h1>
      </div>
      <General />
      <Columns />
      <IssueTypes />
      <ListEditor title="Метки" hint="Подсказки для поля «Метки». Участники могут добавлять и новые метки прямо в задаче." field="labels" chips />
      <ListEditor title="Компоненты" hint="Области проекта: «Геймплей», «Графика»… или комнаты и сферы жизни для дома." field="components" />
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
      <div className="muted small">Колонки: {board.columns.map((c) => c.name).join(' → ')}</div>
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
      <div className="panel-title">Основное</div>
      <div className="form-grid">
        <Field label="Название">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Ключ" hint={key !== board.key ? `Все задачи переименуются: ${board.key}-1 → ${key || '?'}-1` : 'Префикс номеров задач'}>
          <input className="input mono" value={key} onChange={(e) => setKey(sanitizeKey(e.target.value))} maxLength={10} />
        </Field>
      </div>
      <Field label="Описание">
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Иконка">
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} type="button" className={cls('emoji-btn', board.icon === e && 'is-selected')} onClick={() => updateBoard({ icon: e })}>
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Цвет">
          <div className="color-grid">
            {COLORS.map((c) => (
              <button key={c} type="button" className={cls('color-btn', board.color === c && 'is-selected')} style={{ background: c }} onClick={() => updateBoard({ color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={!dirty || !name.trim() || !key} onClick={() => updateBoard({ name: name.trim(), key, description: description.trim() })}>
          Сохранить
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

  const patch = (id: string, p: Partial<Column>) => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cols.length) return;
    const n = [...cols];
    [n[i], n[j]] = [n[j], n[i]];
    setCols(n);
  };

  const remove = async (c: Column) => {
    if (cols.length <= 1) return;
    const inCol = issues.filter((i) => i.status === c.id);
    const target = cols.find((x) => x.id !== c.id)!;
    const ok = await confirm({
      title: `Удалить колонку «${c.name}»?`,
      text: inCol.length ? `${inCol.length} задач будут перенесены в «${target.name}».` : undefined,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    const next = cols.filter((x) => x.id !== c.id);
    await run(async () => {
      for (const i of inCol) await store.updateIssue(board.id, i.id, { status: target.id }, user, [{ field: 'Статус', from: c.name, to: target.name }]);
      await store.updateBoard(board.id, { columns: next });
    });
  };

  return (
    <div className="panel">
      <div className="panel-title">Колонки (статусы)</div>
      <p className="muted small">Категория определяет цвет статуса и что считается «готово» (для релизов, прогресса эпиков и даты решения). Лимит WIP подсвечивает перегруженную колонку.</p>
      <div className="settings-rows">
        <div className="settings-row settings-row-head">
          <span />
          <span>Название</span>
          <span>Категория</span>
          <span>WIP</span>
          <span>Задач</span>
          <span />
        </div>
        {cols.map((c, i) => (
          <div key={c.id} className="settings-row">
            <span className="row-move">
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Левее">
                <Icon name="arrowUp" size={14} />
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label="Правее">
                <Icon name="arrowDown" size={14} />
              </button>
            </span>
            <input className="input" value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
            <Select options={CATEGORIES} value={c.category} onChange={(v) => v && patch(c.id, { category: v as ColumnCategory })} triggerClass={`status-trigger status-${c.category}`} />
            <input className="input input-num" type="number" min={0} value={c.wip || ''} placeholder="∞" onChange={(e) => patch(c.id, { wip: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="muted">{issues.filter((x) => x.status === c.id).length}</span>
            <button className="icon-btn" onClick={() => remove(c)} disabled={cols.length <= 1} aria-label="Удалить колонку">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-subtle" onClick={() => setCols([...cols, { id: newColumnId(), name: 'Новая колонка', category: 'progress', wip: 0 }])}>
          <Icon name="plus" size={16} /> Колонка
        </button>
        <span className="grow" />
        {dirty && (
          <button className="btn btn-subtle" onClick={() => setCols(board.columns)}>
            Отменить
          </button>
        )}
        <button className="btn btn-primary" disabled={!dirty || cols.some((c) => !c.name.trim())} onClick={() => updateBoard({ columns: cols.map((c) => ({ ...c, name: c.name.trim() })) })}>
          Сохранить колонки
        </button>
      </div>
    </div>
  );
}

function IssueTypes() {
  const { confirm } = useApp();
  const { board, issues, updateBoard } = useBoard();
  const [editing, setEditing] = useState<IssueType | null>(null);

  const save = (t: IssueType) => {
    const exists = board.issueTypes.some((x) => x.id === t.id);
    updateBoard({ issueTypes: exists ? board.issueTypes.map((x) => (x.id === t.id ? t : x)) : [...board.issueTypes, t] });
    setEditing(null);
  };
  const remove = async (t: IssueType) => {
    const used = issues.filter((i) => i.type === t.id).length;
    if (used) {
      await confirm({ title: `Тип «${t.name}» используется`, text: `Сначала смените тип у ${used} задач.`, confirmText: 'Понятно' });
      return;
    }
    if (await confirm({ title: `Удалить тип «${t.name}»?`, confirmText: 'Удалить', danger: true })) updateBoard({ issueTypes: board.issueTypes.filter((x) => x.id !== t.id) });
  };

  return (
    <div className="panel">
      <div className="panel-title">Типы задач</div>
      <p className="muted small">У каждого типа может быть шаблон описания и чек-лист — они подставляются при создании задачи.</p>
      <div className="type-list">
        {board.issueTypes.map((t) => (
          <div key={t.id} className="type-row">
            <TypeIcon type={t} size={20} />
            <b>{t.name}</b>
            {t.isEpic && <span className="lozenge lozenge-epic">эпик</span>}
            {t.template && <span className="muted small">шаблон описания</span>}
            {!!t.checklist?.length && <span className="muted small">чек-лист: {t.checklist.length}</span>}
            <span className="grow" />
            <span className="muted small">{issues.filter((i) => i.type === t.id).length} задач</span>
            <button className="icon-btn" onClick={() => setEditing(t)} aria-label="Изменить">
              <Icon name="edit" size={16} />
            </button>
            <button className="icon-btn" onClick={() => remove(t)} aria-label="Удалить">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-subtle" onClick={() => setEditing({ id: 't-' + uid(6), name: '', icon: 'task', color: COLORS[0], template: '', checklist: [] })}>
          <Icon name="plus" size={16} /> Тип задачи
        </button>
      </div>
      {editing && <TypeDialog type={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TypeDialog({ type, onSave, onClose }: { type: IssueType; onSave: (t: IssueType) => void; onClose: () => void }) {
  const [t, setT] = useState<IssueType>(type);
  const [checklist, setChecklist] = useState((type.checklist ?? []).join('\n'));
  return (
    <Modal
      title={type.name ? `Тип «${type.name}»` : 'Новый тип задачи'}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            Отмена
          </button>
          <button
            className="btn btn-primary"
            disabled={!t.name.trim()}
            onClick={() =>
              onSave({
                ...t,
                name: t.name.trim(),
                checklist: checklist
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Сохранить
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Название *">
          <input className="input" autoFocus value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        </Field>
        <Field label="Предпросмотр">
          <span className="type-preview">
            <TypeIcon type={t} size={24} /> {t.name || 'Тип'}
          </span>
        </Field>
      </div>
      <Field label="Иконка">
        <div className="emoji-grid">
          {Object.keys(TYPE_GLYPHS).map((k) => (
            <button key={k} type="button" className={cls('emoji-btn', t.icon === k && 'is-selected')} onClick={() => setT({ ...t, icon: k })} title={k}>
              <TypeIcon type={{ ...t, icon: k }} size={20} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Цвет">
        <div className="color-grid">
          {COLORS.map((c) => (
            <button key={c} type="button" className={cls('color-btn', t.color === c && 'is-selected')} style={{ background: c }} onClick={() => setT({ ...t, color: c })} aria-label={c} />
          ))}
        </div>
      </Field>
      <label className="check-row">
        <input type="checkbox" checked={!!t.isEpic} onChange={(e) => setT({ ...t, isEpic: e.target.checked })} />
        Это эпик (крупная цель, объединяет другие задачи)
      </label>
      <Field label="Шаблон описания">
        <MarkdownEditor value={t.template ?? ''} onChange={(v) => setT({ ...t, template: v })} minRows={5} placeholder="Например: ### Шаги воспроизведения…" />
      </Field>
      <Field label="Чек-лист по умолчанию" hint="Один пункт на строку">
        <textarea className="input" rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </Field>
    </Modal>
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
    if (items.length) updateBoard({ [field]: [...list, ...items] });
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
              <button className="chip-x" onClick={() => updateBoard({ [field]: list.filter((x) => x !== l) })} aria-label={`Убрать ${l}`}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ),
        )}
        {list.length === 0 && <span className="muted small">Пусто</span>}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="Добавить (можно через запятую)" />
        <button className="btn btn-subtle" disabled={!v.trim()}>
          <Icon name="plus" size={16} /> Добавить
        </button>
      </form>
    </div>
  );
}

function ExportPanel() {
  const { board, issues } = useBoard();
  return (
    <div className="panel">
      <div className="panel-title">Экспорт</div>
      <p className="muted small">JSON-файл с настройками доски и всеми задачами (без комментариев). Его можно импортировать на странице «Доски» — например, чтобы перенести доску из демо-режима.</p>
      <button className="btn btn-subtle" onClick={() => downloadJSON(`${board.key}-board.json`, exportBoard(board, issues))}>
        <Icon name="download" size={16} /> Скачать JSON
      </button>
    </div>
  );
}

function DangerZone() {
  const { store, run, confirm } = useApp();
  const { board } = useBoard();
  const [typed, setTyped] = useState('');
  const del = async () => {
    const ok = await confirm({ title: `Удалить доску «${board.name}»?`, text: 'Все задачи, комментарии и история будут удалены навсегда. Отменить это нельзя.', confirmText: 'Удалить навсегда', danger: true });
    if (!ok) return;
    navigate('/');
    await run(store.deleteBoard(board.id), 'Доска удалена');
  };
  return (
    <div className="panel panel-danger">
      <div className="panel-title">Опасная зона</div>
      <p className="muted small">
        Чтобы удалить доску, введите её ключ <b>{board.key}</b>.
      </p>
      <div className="inline-form">
        <input className="input mono" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder={board.key} />
        <button className="btn btn-danger" disabled={typed !== board.key} onClick={del}>
          <Icon name="trash" size={16} /> Удалить доску
        </button>
      </div>
    </div>
  );
}
