import { StrictMode } from 'react';
import { t } from './i18n';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { initStore } from './store';
import { Root } from './App';

const root = createRoot(document.getElementById('root')!);

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
