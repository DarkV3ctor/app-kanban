import { useEffect, useRef, useState } from 'react';
import type { Board } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { TEMPLATES } from '../templates';
import { buildSampleIssues, prepareImport, type BoardExport } from '../lib/issues';
import { roleName, sanitizeKey, suggestKey, cls } from '../lib/utils';
import { Avatar, EmptyState, Field, Modal, Spinner } from './ui';
import { Icon } from './Icons';

export function BoardsPage() {
  const { store, user, toast, run } = useApp();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [canCreate, setCanCreate] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => store.subscribeBoards(user, setBoards, (e) => toast(e.message, 'error')), [store, user, toast]);
  useEffect(() => {
    store.canCreateBoards(user).then(setCanCreate);
  }, [store, user]);

  const importFile = async (f: File) => {
    await run(async () => {
      const data = JSON.parse(await f.text()) as BoardExport;
      const p = prepareImport(data, user);
      const id = await store.createBoard(user, { draft: p.draft, name: p.name + ' (импорт)', key: p.key, description: p.description, issues: p.issues });
      navigate(`/b/${id}`);
    }, 'Доска импортирована');
  };

  const sorted = boards ? [...boards].sort((a, b) => b.updatedAt - a.updatedAt) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Доски</h1>
          <p className="muted">Ваши проекты и доски, к которым вам выдали доступ.</p>
        </div>
        <div className="page-actions">
          {canCreate && (
            <>
              <button className="btn btn-subtle" onClick={() => fileRef.current?.click()} title="Создать доску из JSON-файла экспорта">
                <Icon name="upload" size={16} /> Импорт
              </button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} /> Создать доску
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {canCreate === false && (
        <div className="alert alert-info">
          <Icon name="info" size={16} /> Создавать новые доски могут только пользователи, которым это разрешил администратор. Вы видите доски, куда вас добавили как участника. Ваш GitHub-логин: <b>@{user.login}</b>
        </div>
      )}

      {!sorted ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <EmptyState title="Пока нет досок">
          {canCreate ? (
            <>
              <p className="muted">Создайте первую доску из шаблона — для разработки игры, для дома или пустую.</p>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} /> Создать доску
              </button>
            </>
          ) : (
            <p className="muted">Попросите владельца доски добавить вас по GitHub-логину @{user.login}.</p>
          )}
        </EmptyState>
      ) : (
        <div className="board-grid">
          {sorted.map((b) => (
            <a key={b.id} className="board-card" href={`#/b/${b.id}`} style={{ ['--board-color' as string]: b.color }}>
              <div className="board-card-top">
                <span className="board-icon">{b.icon}</span>
                <div className="board-card-title">
                  <div className="board-name">{b.name}</div>
                  <div className="muted small">
                    {b.key} · {roleName(b.ownerId === user.ghId ? 'owner' : b.members[user.ghId])}
                  </div>
                </div>
              </div>
              {b.description && <p className="board-desc">{b.description}</p>}
              <div className="board-card-foot">
                <div className="avatar-stack">
                  {b.memberIds.slice(0, 5).map((id) => (
                    <Avatar key={id} info={b.memberInfo[id]} size={24} />
                  ))}
                  {b.memberIds.length > 5 && <span className="avatar avatar-more">+{b.memberIds.length - 5}</span>}
                </div>
                <span className="muted small">{b.issueCounter} задач</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {creating && <CreateBoardDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateBoardDialog({ onClose }: { onClose: () => void }) {
  const { store, user, run } = useApp();
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const t = TEMPLATES.find((x) => x.id === tpl)!;
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [samples, setSamples] = useState(true);
  const [busy, setBusy] = useState(false);

  const effectiveKey = keyTouched ? key : name ? sanitizeKey(suggestKey(name)) : t.defaultKey;

  const create = async () => {
    setBusy(true);
    const built = t.build();
    const draft = { ...built.draft };
    const issues = samples ? buildSampleIssues(draft, built.samples, user) : [];
    const id = await run(
      store.createBoard(user, { draft, name: name.trim() || t.name, key: effectiveKey || t.defaultKey, description: description.trim(), issues }),
      'Доска создана',
    );
    setBusy(false);
    if (id) navigate(`/b/${id}`);
  };

  return (
    <Modal
      title="Создать доску"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={create} disabled={busy}>
            {busy ? 'Создание…' : 'Создать'}
          </button>
        </>
      }
    >
      <div className="section-title">Шаблон</div>
      <div className="template-grid">
        {TEMPLATES.map((x) => (
          <button key={x.id} type="button" className={cls('template-card', tpl === x.id && 'is-selected')} onClick={() => setTpl(x.id)} style={{ ['--board-color' as string]: x.color }}>
            <span className="template-icon">{x.icon}</span>
            <span className="template-name">{x.name}</span>
            <span className="template-desc">{x.description}</span>
          </button>
        ))}
      </div>
      <TemplatePreview templateId={tpl} />
      <div className="form-grid">
        <Field label="Название">
          <input className="input" autoFocus value={name} placeholder={t.name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Ключ" hint={`Задачи будут называться ${effectiveKey || t.defaultKey}-1, ${effectiveKey || t.defaultKey}-2…`}>
          <input
            className="input mono"
            value={effectiveKey}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(sanitizeKey(e.target.value));
            }}
            maxLength={10}
          />
        </Field>
      </div>
      <Field label="Описание">
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="О чём эта доска (необязательно)" />
      </Field>
      {t.build().samples.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} />
          Добавить примеры задач, чтобы увидеть, как всё устроено
        </label>
      )}
    </Modal>
  );
}

function TemplatePreview({ templateId }: { templateId: string }) {
  const t = TEMPLATES.find((x) => x.id === templateId)!;
  const { draft } = t.build();
  return (
    <div className="template-preview">
      <div>
        <span className="muted small">Колонки:</span> {draft.columns.map((c) => c.name).join(' → ')}
      </div>
      <div>
        <span className="muted small">Типы задач:</span> {draft.issueTypes.map((x) => x.name).join(', ')}
      </div>
      {draft.components.length > 0 && (
        <div>
          <span className="muted small">Компоненты:</span> {draft.components.join(', ')}
        </div>
      )}
      {draft.versions.length > 0 && (
        <div>
          <span className="muted small">Версии:</span> {draft.versions.map((v) => v.name).join(', ')}
        </div>
      )}
    </div>
  );
}
