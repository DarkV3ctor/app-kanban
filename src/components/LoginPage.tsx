import { useState } from 'react';
import type { Store } from '../store';
import { t } from '../i18n';
import { GitHubMark, Icon } from './Icons';
import { LangSwitch } from './LangSwitch';

export function LoginPage({ store }: { store: Store }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo = store.mode === 'local';

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await store.signIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <LangSwitch className="login-lang" />
      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0C66E4" />
            <rect x="6" y="7" width="5" height="18" rx="1.5" fill="#fff" />
            <rect x="13.5" y="7" width="5" height="12" rx="1.5" fill="#fff" opacity=".85" />
            <rect x="21" y="7" width="5" height="8" rx="1.5" fill="#fff" opacity=".7" />
          </svg>
        </div>
        <h1>Kanban</h1>
        <p className="muted">{t('Jira-style boards: epics, versions, priorities, Markdown descriptions, checklists, comments and team permissions.')}</p>
        <button className="btn btn-github btn-lg" onClick={signIn} disabled={busy}>
          {demo ? <Icon name="user" size={18} /> : <GitHubMark size={18} />}
          {busy ? t('Signing in…') : demo ? t('Enter demo mode') : t('Sign in with GitHub')}
        </button>
        {error && <div className="alert alert-error">{error}</div>}
        <ul className="login-features">
          <li>🎮 {t('Game dev template: features, bugs, art, audio, levels, milestones')}</li>
          <li>🏠 {t('Home template: chores, shopping, repairs, finances, health')}</li>
          <li>👥 {t('Members by GitHub username and 5 access levels')}</li>
        </ul>
      </div>
    </div>
  );
}
