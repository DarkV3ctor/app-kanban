import { useRef, useState } from 'react';
import { setAppearance, useAppearance, useIsDark, type Design, type Mode } from '../appearance';
import { t } from '../i18n';
import { cls } from '../lib/utils';
import { Icon } from './Icons';
import { Popover } from './ui';

const DESIGNS: { id: Design; label: () => string }[] = [
  { id: 'classic', label: () => t('Classic') },
  { id: 'apple', label: () => 'Apple' },
  { id: 'fluent', label: () => 'Fluent' },
  { id: 'linux', label: () => 'Linux' },
];

const MODES: { id: Mode; icon: string; label: () => string; title?: () => string }[] = [
  { id: 'light', icon: 'sun', label: () => t('Light') },
  { id: 'dark', icon: 'moon', label: () => t('Dark') },
  { id: 'system', icon: 'monitor', label: () => t('Auto'), title: () => t('Follow the system setting') },
];

const MODE_ICON: Record<Mode, string> = { light: 'sun', dark: 'moon', system: 'appearance' };

/** Top bar button with a popover to pick the design (Classic / Apple / Fluent / Linux) and the light / dark / auto mode. */
export function AppearanceMenu({ className }: { className?: string }) {
  const { design, mode } = useAppearance();
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cls('icon-btn', className)}
        onClick={() => setOpen((o) => !o)}
        title={t('Appearance')}
        aria-label={t('Appearance')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name={MODE_ICON[mode]} size={18} />
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} width={332} align="end">
          <div className="appearance" role="dialog" aria-label={t('Appearance')}>
            <div className="appearance-label" id="appearance-design">
              {t('Style')}
            </div>
            <div className="design-options" role="radiogroup" aria-labelledby="appearance-design">
              {DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={d.id === design}
                  className={cls('design-option', d.id === design && 'is-selected')}
                  onClick={() => setAppearance({ design: d.id })}
                >
                  <DesignPreview design={d.id} dark={dark} />
                  <span className="design-name">{d.label()}</span>
                </button>
              ))}
            </div>
            <div className="appearance-label" id="appearance-mode">
              {t('Theme')}
            </div>
            <div className="seg seg-full" role="radiogroup" aria-labelledby="appearance-mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={m.id === mode}
                  className={cls(m.id === mode && 'is-active')}
                  onClick={() => setAppearance({ mode: m.id })}
                  title={m.title?.()}
                >
                  <Icon name={m.icon} size={14} />
                  {m.label()}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}

/** A tiny board drawn in the colours of a design, so the options can be compared at a glance. */
function DesignPreview({ design, dark }: { design: Design; dark: boolean }) {
  return (
    <span className={cls('design-preview', `preview-${design}`, dark && 'is-dark')} aria-hidden="true">
      <span className="pv-bar">
        <span className="pv-logo" />
        <span className="pv-btn" />
      </span>
      <span className="pv-cols">
        <span className="pv-col">
          <span className="pv-card" />
          <span className="pv-card" />
        </span>
        <span className="pv-col">
          <span className="pv-card" />
        </span>
        <span className="pv-col">
          <span className="pv-card" />
        </span>
      </span>
    </span>
  );
}
