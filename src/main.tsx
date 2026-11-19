import { StrictMode } from 'react';
import { t } from './i18n';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './styles-apple.css';
import './styles-fluent.css';
import './styles-linux.css';
import { initStore } from './store';
import { Root } from './App';
import { Spinner } from './components/ui';
import { loadBoardPage } from './board-loader';

const root = createRoot(document.getElementById('root')!);

if (window.top !== window.self) {
  // Never run inside another site's frame, where clicks could be steered (clickjacking).
  // GitHub Pages cannot send the frame-ancestors / X-Frame-Options headers, so this is done here.
  root.render(
    <div style={{ padding: 32, fontFamily: 'system-ui' }}>
      <p>{t('This app cannot be shown inside another site.')}</p>
      <a href={location.href} target="_blank" rel="noopener noreferrer">
        {t('Open it in a new tab')}
      </a>
    </div>,
  );
} else {
  // Shown while the storage (Firebase) loads, instead of a blank page.
  root.render(<Spinner label={t('Loading…')} />);
  // A link to a board: fetch the board chunk in parallel with Firebase.
  if (location.hash.startsWith('#/b/')) loadBoardPage().catch(() => {});

  initStore()
    .then((store) =>
      root.render(
        <StrictMode>
          <Root store={store} />
        </StrictMode>,
      ),
    )
    .catch((e) => {
      console.error(e);
      root.render(
        <div style={{ padding: 32, fontFamily: 'system-ui' }}>
          <h2>{t('Failed to start the app')}</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(e?.message ?? e)}</pre>
          <p>{t('Check the Firebase settings in config.js.')}</p>
        </div>,
      );
    });
}
