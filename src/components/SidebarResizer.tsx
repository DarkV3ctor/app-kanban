import { useCallback, useEffect, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { t } from '../i18n';

/*
 * The board menu on wide screens: a column whose width can be dragged and which can be hidden.
 * Both choices are kept in this browser for every board. On narrow screens (see isNarrow) the
 * menu is a drawer instead, and neither applies.
 */

export const SIDEBAR_WIDTH = { min: 180, initial: 240, max: 420 } as const;
const WIDTH_KEY = 'kb-sidebar-width';
const HIDDEN_KEY = 'kb-sidebar-hidden';
/** Dragging the edge this far past the minimum width hides the menu. */
const HIDE_SLACK = 72;
const KEY_STEP = 16;

/** Keep in sync with the drawer breakpoint in styles.css. */
export const isNarrow = () => matchMedia('(max-width: 760px)').matches;

const clampWidth = (w: number) => Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, w)));

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
}

export function useSidebarPrefs() {
  const [width, setWidthState] = useState(() => {
    const saved = Number(read(WIDTH_KEY));
    return saved > 0 ? clampWidth(saved) : SIDEBAR_WIDTH.initial;
  });
  const [hidden, setHiddenState] = useState(() => read(HIDDEN_KEY) === '1');
  const setWidth = useCallback((w: number) => {
    const next = clampWidth(w);
    setWidthState(next);
    write(WIDTH_KEY, next === SIDEBAR_WIDTH.initial ? null : String(next));
  }, []);
  const setHidden = useCallback((h: boolean) => {
    setHiddenState(h);
    write(HIDDEN_KEY, h ? '1' : null);
  }, []);
  return { width, setWidth, hidden, setHidden };
}

/**
 * The draggable right edge of the menu (a window splitter: arrows resize, Home / End jump to the
 * limits, Enter hides; double-click restores the initial width). While dragging, the width is
 * written straight to `--sidebar-w` on the layout so the board does not re-render on every move;
 * it is committed through onResize when the pointer is released.
 */
export function SidebarResizer({
  layoutRef,
  width,
  onResize,
  onHide,
}: {
  layoutRef: RefObject<HTMLElement | null>;
  width: number;
  onResize: (width: number) => void;
  onHide: () => void;
}) {
  // If the handle goes away mid-drag (navigating to another page), its pointer events stop coming:
  // drop the page-wide resize cursor and text-selection lock with it.
  useEffect(() => () => document.documentElement.classList.remove('is-resizing-sidebar'), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const layout = layoutRef.current;
    if (e.button !== 0 || !layout) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const root = document.documentElement;
    root.classList.add('is-resizing-sidebar');
    const startX = e.clientX;
    let next = width;
    let hide = false;

    const preview = (w: number, h: boolean) => {
      layout.style.setProperty('--sidebar-w', `${w}px`);
      layout.toggleAttribute('data-drag-hidden', h);
    };
    const move = (ev: PointerEvent) => {
      const raw = width + ev.clientX - startX;
      next = clampWidth(raw);
      hide = raw < SIDEBAR_WIDTH.min - HIDE_SLACK;
      preview(next, hide);
    };
    const end = (ev: PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      root.classList.remove('is-resizing-sidebar');
      const cancelled = ev.type === 'pointercancel';
      // A hidden menu keeps its previous width for when it is shown again.
      preview(cancelled || hide ? width : next, false);
      if (cancelled) return;
      if (hide) onHide();
      else if (next !== width) onResize(next);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    let w: number;
    if (e.key === 'ArrowLeft') w = width - step;
    else if (e.key === 'ArrowRight') w = width + step;
    else if (e.key === 'Home') w = SIDEBAR_WIDTH.min;
    else if (e.key === 'End') w = SIDEBAR_WIDTH.max;
    else if (e.key === 'Enter') {
      e.preventDefault();
      onHide();
      return;
    } else return;
    e.preventDefault();
    onResize(w);
  };

  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-controls="board-sidebar"
      aria-label={t('Menu width')}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      tabIndex={0}
      title={t('Drag to resize, double-click to reset')}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(SIDEBAR_WIDTH.initial)}
    />
  );
}
