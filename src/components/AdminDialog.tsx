import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import type { CreatorEntry } from '../store';
import { config } from '../config';
import { lookupGitHubUser } from '../lib/github';
import { Avatar, Modal } from './ui';
import { Icon } from './Icons';

/** Управление списком пользователей, которым разрешено создавать доски. */
export function AdminDialog({ onClose }: { onClose: () => void }) {
  const { store, run, toast } = useApp();
  const [list, setList] = useState<CreatorEntry[]>([]);
  const [login, setLogin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => store.subscribeCreators(setList, (e) => toast(e.message, 'error')), [store, toast]);

  const add = async () => {
    if (!login.trim()) return;
    setBusy(true);
    await run(async () => {
      const u = await lookupGitHubUser(login);
      await store.addCreator(u);
      setLogin('');
    }, 'Доступ выдан');
    setBusy(false);
  };

  return (
    <Modal title="Кто может создавать доски" onClose={onClose} size="md">
      <p className="muted">
        Войти через GitHub может любой, но создавать новые доски — только администраторы приложения и пользователи из этого списка. Доступ к конкретной доске
        настраивается на её странице «Участники».
      </p>
      <div className="section-title">Администраторы приложения</div>
      <p className="small muted">
        Задаются в <code>config.js</code> и <code>firestore.rules</code>: {config.appAdmins.join(', ') || '—'}
      </p>
      <div className="section-title">Разрешено создавать доски</div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" placeholder="GitHub логин" value={login} onChange={(e) => setLogin(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !login.trim()}>
          <Icon name="plus" size={16} /> Добавить
        </button>
      </form>
      <div className="member-list">
        {list.length === 0 && <div className="muted small">Пока никого</div>}
        {list.map((c) => (
          <div key={c.ghId} className="member-row">
            <Avatar info={c} size={32} />
            <div className="member-main">
              <div>{c.name}</div>
              <div className="muted small">@{c.login}</div>
            </div>
            <button className="btn btn-subtle" onClick={() => run(store.removeCreator(c.ghId), 'Доступ отозван')}>
              Убрать
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
