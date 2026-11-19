import { useEffect, useRef, useState } from 'react';
import type { AppUser } from './types';
import type { Store } from './store';
import { AppProvider, useApp } from './app-context';
import { navigate, useRoute } from './router';
import { config, isDemo } from './config';
import { t } from './i18n';
import { AppLogo, Icon, GitHubMark } from './components/Icons';
import { Avatar, ErrorBoundary, Popover, Spinner } from './components/ui';
import { LoginPage } from './components/LoginPage';
import { BoardsPage } from './components/BoardsPage';
import { BoardPage } from './components/BoardPage';
import { AdminDialog } from './components/AdminDialog';
import { LangSwitch } from './components/LangSwitch';
import { AppearanceMenu } from './components/AppearanceMenu';

export function Root({ store }: { store: Store }) {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  useEffect(() => store.onAuth(setUser), [store]);

  if (user === undefined) return <Spinner label={t('Loading…')} />;
  if (!user) return <LoginPage store={store} />;
  return (
    <AppProvider store={store} user={user}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { segments } = route;
  let content;
  if (segments[0] === 'b' && segments[1]) {
    content = <BoardPage key={segments[1]} boardId={segments[1]} view={segments[2] ?? 'board'} route={route} />;
  } else {
    content = <BoardsPage />;
  }
  return (
    <div className="app">
      <TopBar />
      {isDemo && (
        <div className="demo-banner">
          <Icon name="info" size={16} />
          <span>
            <b>{t('Demo mode.')}</b> {t('Data is stored only in this browser. Connect Firebase to enable GitHub sign-in and collaboration — see the README.')}
          </span>
        </div>
      )}
      <div className="app-content">
        <ErrorBoundary resetKey={route.path}>{content}</ErrorBoundary>
      </div>
    </div>
  );
}

function TopBar() {
  const { user, store } = useApp();
  const [menu, setMenu] = useState(false);
  const [admin, setAdmin] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const isAppAdmin = !isDemo && config.appAdmins.includes(user.ghId);

  return (
    <header className="topbar">
      <a className="brand" href="#/" onClick={(e) => (e.preventDefault(), navigate('/'))}>
        <AppLogo size={24} />
        <span>Kanban</span>
      </a>
      <nav className="topnav">
        <a href="#/" onClick={(e) => (e.preventDefault(), navigate('/'))}>
          {t('Boards')}
        </a>
      </nav>
      <div className="topbar-spacer" />
      <LangSwitch />
      <AppearanceMenu className="topbar-btn" />
      <button ref={btn} className="user-btn" onClick={() => setMenu((m) => !m)} aria-label={t('User menu')}>
        <Avatar info={user} size={28} />
      </button>
      {menu && (
        <Popover anchor={btn.current} onClose={() => setMenu(false)} width={260} align="end">
          <div className="user-card">
            <Avatar info={user} size={40} />
            <div>
              <div className="user-card-name">{user.name}</div>
              <div className="muted small">{store.mode === 'local' ? t('Local demo profile') : `@${user.login} · GitHub ID ${user.ghId}`}</div>
            </div>
          </div>
          <div className="menu">
            {isAppAdmin && (
              <button
                className="menu-item"
                onClick={() => {
                  setMenu(false);
                  setAdmin(true);
                }}
              >
                <Icon name="shield" size={16} />
                <span className="menu-label">{t('Who can create boards')}</span>
              </button>
            )}
            {store.mode === 'firebase' && (
              <a className="menu-item" href={`https://github.com/${user.login}`} target="_blank" rel="noreferrer">
                <GitHubMark size={16} />
                <span className="menu-label">{t('GitHub profile')}</span>
              </a>
            )}
            <button className="menu-item" onClick={() => store.signOut()}>
              <Icon name="logout" size={16} />
              <span className="menu-label">{t('Sign out')}</span>
            </button>
          </div>
        </Popover>
      )}
      {admin && <AdminDialog onClose={() => setAdmin(false)} />}
    </header>
  );
}
