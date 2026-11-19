import { LANGS, lang, setLang, t } from '../i18n';
import { cls } from '../lib/utils';

/** EN / UA switch. Changing the language reloads the page. */
export function LangSwitch({ className }: { className?: string }) {
  return (
    <div className={cls('lang-switch', className)} role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={cls(l.id === lang && 'is-active')} onClick={() => l.id !== lang && setLang(l.id)} title={l.label} aria-pressed={l.id === lang}>
          {l.short}
        </button>
      ))}
    </div>
  );
}
