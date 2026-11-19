import { useSyncExternalStore } from 'react';

/**
 * Appearance = design × colour mode. Both are saved in localStorage and applied as attributes
 * on <html>, which the stylesheets key off:
 *   data-design="classic|apple|fluent"  — styles-apple.css / styles-fluent.css
 *   data-theme="light|dark"      — no attribute means "follow the system setting"
 * public/theme.js applies the saved values before the app renders, so the page never flashes
 * in the wrong theme. Keep the storage keys in sync with that file.
 */

export type Design = 'classic' | 'apple' | 'fluent';
export type Mode = 'light' | 'dark' | 'system';

interface Appearance {
  design: Design;
  mode: Mode;
}

const DESIGN_KEY = 'kb-design';
const MODE_KEY = 'kb-theme';
const root = document.documentElement;
const listeners = new Set<() => void>();

const asDesign = (v: string | null): Design => (v === 'apple' || v === 'fluent' ? v : 'classic');
const asMode = (v: string | null): Mode => (v === 'light' || v === 'dark' ? v : 'system');

let current: Appearance = { design: asDesign(root.getAttribute('data-design')), mode: asMode(root.getAttribute('data-theme')) };

function apply(next: Appearance) {
  root.setAttribute('data-design', next.design);
  if (next.mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next.mode);
  current = next;
  listeners.forEach((l) => l());
}

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
}

/** Changes the design and/or mode, with a short cross-fade where the browser supports it. */
export function setAppearance(change: Partial<Appearance>) {
  const next = { ...current, ...change };
  if (next.design === current.design && next.mode === current.mode) return;
  save(DESIGN_KEY, next.design === 'classic' ? null : next.design);
  save(MODE_KEY, next.mode === 'system' ? null : next.mode);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && typeof document.startViewTransition === 'function') document.startViewTransition(() => apply(next));
  else apply(next);
}

// Follow changes made in other tabs.
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== DESIGN_KEY && e.key !== MODE_KEY) return;
  let design: string | null = null;
  let mode: string | null = null;
  try {
    design = localStorage.getItem(DESIGN_KEY);
    mode = localStorage.getItem(MODE_KEY);
  } catch {
    return;
  }
  const next = { design: asDesign(design), mode: asMode(mode) };
  if (next.design !== current.design || next.mode !== current.mode) apply(next);
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => current);
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const subscribeDark = (l: () => void) => {
  darkQuery.addEventListener('change', l);
  return () => darkQuery.removeEventListener('change', l);
};

/** True when the page is currently shown in dark mode (an explicit choice or the system setting). */
export function useIsDark(): boolean {
  const { mode } = useAppearance();
  const systemDark = useSyncExternalStore(subscribeDark, () => darkQuery.matches);
  return mode === 'dark' || (mode === 'system' && systemDark);
}
