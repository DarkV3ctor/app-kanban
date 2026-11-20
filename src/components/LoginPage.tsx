import { useEffect, useState } from 'react';
import type { Store } from '../store';
import { t } from '../i18n';
import { AppLogo, GitHubMark, Icon } from './Icons';
import { LangSwitch } from './LangSwitch';
import { AppearanceMenu } from './AppearanceMenu';

export function LoginPage({ store }: { store: Store }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demo = store.mode === 'local';

  // Errors of a redirect sign-in arrive after the page has reloaded.
  useEffect(() => {
    let alive = true;
    store.consumeAuthError().then((e) => alive && e && setError(e));
    return () => {
      alive = false;
    };
  }, [store]);

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
      <div className="login-tools">
        <LangSwitch />
        <AppearanceMenu />
      </div>
      <div className="login-card">
        <div className="login-logo">
          <AppLogo size={48} />
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
          <li>🍿 {t('Movies, series and games: covers, release dates, ratings')}</li>
          <li>👥 {t('Members by GitHub username and 5 access levels')}</li>
        </ul>
      </div>
    </div>
  );
}
