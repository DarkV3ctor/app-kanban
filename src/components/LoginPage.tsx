import { useState } from 'react';
import type { Store } from '../store';
import { GitHubMark, Icon } from './Icons';

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
        <p className="muted">Доски задач в стиле Jira: эпики, версии, приоритеты, описание в Markdown, чек-листы, комментарии и права доступа для команды.</p>
        <button className="btn btn-github btn-lg" onClick={signIn} disabled={busy}>
          {demo ? <Icon name="user" size={18} /> : <GitHubMark size={18} />}
          {busy ? 'Вход…' : demo ? 'Войти в демо-режим' : 'Войти через GitHub'}
        </button>
        {error && <div className="alert alert-error">{error}</div>}
        <ul className="login-features">
          <li>🎮 Шаблон для разработки игр: фичи, баги, арт, звук, уровни, вехи</li>
          <li>🏠 Шаблон для дома: дела, покупки, ремонт, финансы, здоровье</li>
          <li>👥 Участники по GitHub-логину и 5 уровней доступа</li>
        </ul>
      </div>
    </div>
  );
}
