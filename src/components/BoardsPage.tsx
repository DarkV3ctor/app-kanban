import { useEffect, useRef, useState } from 'react';
import type { Board } from '../types';
import { useApp, useDiscardGuard } from '../app-context';
import { prefetchBoardPage } from '../board-loader';
import { navigate } from '../router';
import { count, t } from '../i18n';
import { TEMPLATES } from '../templates';
import { buildSampleIssues, prepareImport } from '../lib/issues';
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
  useEffect(prefetchBoardPage, []);
  useEffect(() => {
    store.canCreateBoards(user).then(setCanCreate);
  }, [store, user]);

  // Real issue counts (the board's issueCounter is the last issue number, not the count).
  const [counts, setCounts] = useState<Record<string, number>>({});
  const countedAt = useRef(new Map<string, number>());
  useEffect(() => {
    for (const b of boards ?? []) {
      if (countedAt.current.get(b.id) === b.updatedAt) continue;
      countedAt.current.set(b.id, b.updatedAt);
      store.countIssues(b.id).then((n) => {
        if (n !== null) setCounts((c) => ({ ...c, [b.id]: n }));
      });
    }
  }, [boards, store]);

  const importFile = async (f: File) => {
    await run(async () => {
      let data: unknown;
      try {
        data = JSON.parse(await f.text());
      } catch {
        throw new Error(t('This is not a board export file'));
      }
      const p = prepareImport(data, user);
      const id = await store.createBoard(user, { draft: p.draft, name: `${p.name} (${t('import')})`, key: p.key, description: p.description, issues: p.issues });
      navigate(`/b/${id}`);
    }, t('Board imported'));
  };

  const sorted = boards ? [...boards].sort((a, b) => b.updatedAt - a.updatedAt) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('Boards')}</h1>
          <p className="muted">{t('Your projects and the boards you have been given access to.')}</p>
        </div>
        <div className="page-actions">
          {canCreate && (
            <>
              <button className="btn btn-subtle" onClick={() => fileRef.current?.click()} title={t('Create a board from a JSON export file')}>
                <Icon name="upload" size={16} /> {t('Import')}
              </button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} /> {t('Create board')}
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
          <Icon name="info" size={16} />
          <span>
            {t('Only users allowed by an admin can create new boards. You can see the boards you were added to as a member. Your GitHub username:')} <b>@{user.login}</b>
          </span>
        </div>
      )}

      {!sorted ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <EmptyState title={t('No boards yet')}>
          {canCreate ? (
            <>
              <p className="muted">{t('Create your first board from a template — for game development, for home, or a blank one.')}</p>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} /> {t('Create board')}
              </button>
            </>
          ) : (
            <p className="muted">{t('Ask a board owner to add you by your GitHub username @{login}.', { login: user.login })}</p>
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
                {counts[b.id] !== undefined && <span className="muted small">{count(counts[b.id], 'issue')}</span>}
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
  const template = TEMPLATES.find((x) => x.id === tpl)!;
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [samples, setSamples] = useState(true);
  const [busy, setBusy] = useState(false);

  const effectiveKey = keyTouched ? key : name ? sanitizeKey(suggestKey(name)) : template.defaultKey;
  const shownKey = effectiveKey || template.defaultKey;
  const canDiscard = useDiscardGuard();
  const requestClose = async () => {
    if (await canDiscard(!!(name.trim() || description.trim()))) onClose();
  };

  const create = async () => {
    setBusy(true);
    const built = template.build();
    const issues = samples ? buildSampleIssues(built.draft, built.samples, user) : [];
    const id = await run(
      store.createBoard(user, { draft: built.draft, name: name.trim() || template.name, key: shownKey, description: description.trim(), issues }),
      t('Board created'),
    );
    setBusy(false);
    if (id) navigate(`/b/${id}`);
  };

  return (
    <Modal
      title={t('Create board')}
      onClose={requestClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-subtle" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={create} disabled={busy}>
            {busy ? t('Creating…') : t('Create')}
          </button>
        </>
      }
    >
      <div className="section-title">{t('Template')}</div>
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
        <Field label={t('Name')}>
          <input className="input" autoFocus value={name} placeholder={template.name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t('Key')} hint={t('Issues will be numbered {key}-1, {key}-2…', { key: shownKey })}>
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
      <Field label={t('Description')}>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('What this board is about (optional)')} maxLength={5000} />
      </Field>
      {template.build().samples.length > 0 && (
        <label className="check-row">
          <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} />
          {t('Add sample issues to see how everything works')}
        </label>
      )}
    </Modal>
  );
}

function TemplatePreview({ templateId }: { templateId: string }) {
  const template = TEMPLATES.find((x) => x.id === templateId)!;
  const { draft } = template.build();
  return (
    <div className="template-preview">
      <div>
        <span className="muted small">{t('Columns:')}</span> {draft.columns.map((c) => c.name).join(' → ')}
      </div>
      <div>
        <span className="muted small">{t('Issue types:')}</span> {draft.issueTypes.map((x) => x.name).join(', ')}
      </div>
      {draft.components.length > 0 && (
        <div>
          <span className="muted small">{t('Components:')}</span> {draft.components.join(', ')}
        </div>
      )}
      {draft.versions.length > 0 && (
        <div>
          <span className="muted small">{t('Versions:')}</span> {draft.versions.map((v) => v.name).join(', ')}
        </div>
      )}
    </div>
  );
}
