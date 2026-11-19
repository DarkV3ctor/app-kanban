import { UK, UK_PLURALS } from './locales/uk';

/**
 * Minimal i18n: English strings are the keys, other languages map them to translations.
 * The language is fixed for the lifetime of the page — switching reloads the app.
 */

export type Lang = 'en' | 'uk';

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'uk', label: 'Українська', short: 'UA' },
];

const STORAGE_KEY = 'kb-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'uk') return saved;
  } catch {
    /* ignore */
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return prefs.some((l) => /^(uk|ru|be)\b/i.test(l)) ? 'uk' : 'en';
}

export const lang: Lang = detect();
export const locale = lang === 'uk' ? 'uk-UA' : 'en-US';

document.documentElement.lang = lang;

export function setLang(next: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  location.reload();
}

const DICT: Record<string, string> | null = lang === 'uk' ? UK : null;

/** Translate an English UI string. `{name}` placeholders are filled from `params`. */
export function t(text: string, params?: Record<string, string | number>): string {
  let out = DICT?.[text] ?? text;
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m));
  return out;
}

/** Marks a string as a translation key without translating it (for constant tables). */
export const tk = (text: string): string => text;

/** English plural forms: [one, other]. Ukrainian forms ([one, few, many]) live in the locale file. */
const EN_PLURALS = {
  issue: ['issue', 'issues'],
} as const;

export type PluralKey = keyof typeof EN_PLURALS;

/** Formats a count with the correctly declined noun, e.g. "1 issue", "5 issues". */
export function count(n: number, noun: PluralKey): string {
  if (lang !== 'uk') return `${n} ${EN_PLURALS[noun][n === 1 ? 0 : 1]}`;
  const forms = UK_PLURALS[noun];
  const m10 = n % 10;
  const m100 = n % 100;
  const idx = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
  return `${n} ${forms[idx]}`;
}
