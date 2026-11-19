import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import type { CreatorEntry } from '../store';
import { config } from '../config';
import { t } from '../i18n';
import { lookupGitHubUser } from '../lib/github';
import { Avatar, Modal } from './ui';
import { Icon } from './Icons';

/** Manages the list of users who are allowed to create boards. */
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
    }, t('Access granted'));
    setBusy(false);
  };

  return (
    <Modal title={t('Who can create boards')} onClose={onClose} size="md">
      <p className="muted">
        {t(
          'Anyone can sign in with GitHub, but only app admins and the users in this list can create new boards. Access to a specific board is managed on its Members page.',
        )}
      </p>
      <div className="section-title">{t('App admins')}</div>
      <p className="small muted">
        {t('Set in config.js and firestore.rules:')} {config.appAdmins.join(', ') || '—'}
      </p>
      <div className="section-title">{t('Allowed to create boards')}</div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input" placeholder={t('GitHub username')} value={login} onChange={(e) => setLogin(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !login.trim()}>
          <Icon name="plus" size={16} /> {t('Add')}
        </button>
      </form>
      <div className="member-list">
        {list.length === 0 && <div className="muted small">{t('Nobody yet')}</div>}
        {list.map((c) => (
          <div key={c.ghId} className="member-row">
            <Avatar info={c} size={32} />
            <div className="member-main">
              <div>{c.name}</div>
              <div className="muted small">@{c.login}</div>
            </div>
            <button className="btn btn-subtle" onClick={() => run(store.removeCreator(c.ghId), t('Access revoked'))}>
              {t('Remove')}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
