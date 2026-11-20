import { useId, type CSSProperties, type ReactNode } from 'react';
import type { IssueType, Priority } from '../types';
import { PRIORITIES, priorityName } from '../lib/utils';

// ---------------------------------------------------------------------------
// UI icons (stroke, 24x24)
// ---------------------------------------------------------------------------

const UI: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  board: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9.5 4v16M14.5 4v16" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  chart: (
    <>
      <path d="M4 4v15.5h16" />
      <path d="M8.5 16v-4M12.5 16V8M16.5 16v-6" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  release: (
    <>
      <path d="M3.5 12.5l8.5-8.5h7.5v7.5L11 20z" />
      <circle cx="15.5" cy="8" r="1.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.6 3 5.2" />
    </>
  ),
  logout: <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16.5L5.5 12 10 7.5M5.5 12H15" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  filter: <path d="M4 5h16l-6.2 7.5V19l-3.6-1.8v-4.7z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  comment: <path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />,
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 4v4.5H8M12 7.5V12l3 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  checklist: <path d="M4 6.5l1.8 1.8L9 5M4 13l1.8 1.8L9 11.5M12.5 7h7.5M12.5 13.5h7.5M12.5 19h7.5M4.5 19h.01" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.01" />
    </>
  ),
  home: <path d="M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  star: <path d="M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.6-5 2.6.9-5.6-4-4 5.6-.8z" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M20.5 16l-5-5-9 8.5" />
    </>
  ),
  // A side panel folding to the left: "hide the menu".
  sidebarHide: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15M16 9.5L13.5 12l2.5 2.5" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  // Half-filled circle: "follow the system light / dark setting".
  appearance: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
};

export type IconName = keyof typeof UI;

export function Icon({ name, size = 16, style, className }: { name: IconName | string; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {UI[name] ?? UI.info}
    </svg>
  );
}

export function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** App logo. Its colours come from the --brand-from / --brand-to tokens of the active design. */
export function AppLogo({ size }: { size: number }) {
  // useId() may contain characters that are not valid in url(#…) references.
  const id = `logo${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="logo-from" />
          <stop offset="1" className="logo-to" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill={`url(#${id})`} />
      <rect x="6" y="7" width="5" height="18" rx="1.5" fill="#fff" />
      <rect x="13.5" y="7" width="5" height="12" rx="1.5" fill="#fff" opacity=".85" />
      <rect x="21" y="7" width="5" height="8" rx="1.5" fill="#fff" opacity=".7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Issue type icons (white glyph on a colored square, 16x16)
// ---------------------------------------------------------------------------

const S = { stroke: '#fff', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: '#fff' } as const;

export const TYPE_GLYPHS: Record<string, ReactNode> = {
  task: <path d="M4.6 8.3l2.2 2.2 4.6-4.8" {...S} strokeWidth={1.8} />,
  story: <path d="M5 3.6h6v8.9L8 10.3l-3 2.2z" {...F} />,
  bug: <circle cx="8" cy="8" r="3.1" {...F} />,
  epic: <path d="M9.2 2.8L4.8 9h3l-1 4.2L11.2 7h-3z" {...F} />,
  subtask: (
    <>
      <rect x="3.6" y="3.6" width="5" height="5" rx="1" {...S} />
      <rect x="7.4" y="7.4" width="5" height="5" rx="1" {...F} />
    </>
  ),
  art: (
    <>
      <path d="M10.6 3.2l2.2 2.2-5.1 5.1-2.2-2.2z" {...F} />
      <path d="M5 9.5l1.5 1.5c-.3 1.3-1.4 2-2.9 2 .1-1.4.5-2.6 1.4-3.5z" {...F} />
    </>
  ),
  audio: <path d="M6.3 4.6v5.5a1.7 1.7 0 1 0 1.2 1.6V6.4l3.4-.9v3.4a1.7 1.7 0 1 0 1.2 1.6V3.3z" {...F} />,
  map: <path d="M3.4 4.7l3-1.2 3.2 1.2 3-1.2v7.8l-3 1.2-3.2-1.2-3 1.2zM6.4 3.5v7.8M9.6 4.7v7.8" {...S} strokeWidth={1.2} />,
  puzzle: <path d="M8 2.9l1.5 3.1 3.4.5-2.5 2.4.6 3.4L8 10.7l-3 1.6.6-3.4-2.5-2.4 3.4-.5z" {...F} />,
  gear: (
    <>
      <circle cx="8" cy="8" r="2.2" {...S} />
      <path d="M8 3.2v1.4M8 11.4v1.4M3.2 8h1.4M11.4 8h1.4M4.6 4.6l1 1M10.4 10.4l1 1M4.6 11.4l1-1M10.4 5.6l1-1" {...S} />
    </>
  ),
  flag: (
    <>
      <path d="M5 3v10" {...S} strokeWidth={1.6} />
      <path d="M5.6 3.4h6.2L10.3 6l1.5 2.6H5.6z" {...F} />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h1.6l1.3 5.3h5.4l1.2-4H5.2" {...S} />
      <circle cx="6.6" cy="11.8" r="1" {...F} />
      <circle cx="10.8" cy="11.8" r="1" {...F} />
    </>
  ),
  wrench: <path d="M11.9 4.2a2.6 2.6 0 0 0-3.5 3.2L4 11.8 5.2 13l4.4-4.4a2.6 2.6 0 0 0 3.2-3.5l-1.5 1.5-1.4-.4-.4-1.4z" {...F} />,
  coin: (
    <>
      <circle cx="8" cy="8" r="4.6" {...S} />
      <path d="M9.6 6.4c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.5-1.6 1.2 0 1.6 3.3.8 3.3 2.4 0 .7-.7 1.2-1.7 1.2-.7 0-1.3-.3-1.7-.8M8 4.8v.8M8 10.4v.8" {...S} strokeWidth={1.1} />
    </>
  ),
  heart: <path d="M8 12.8S3.2 10 3.2 6.6A2.4 2.4 0 0 1 8 5.4a2.4 2.4 0 0 1 4.8 1.2c0 3.4-4.8 6.2-4.8 6.2z" {...F} />,
  calendar: (
    <>
      <rect x="3.5" y="4.4" width="9" height="8.3" rx="1.2" {...S} />
      <path d="M3.5 7h9M6 3.2v2M10 3.2v2" {...S} />
    </>
  ),
  book: <path d="M3.4 4.3c1.6-.6 3.1-.5 4.6.5 1.5-1 3-1.1 4.6-.5v7.8c-1.6-.6-3.1-.5-4.6.5-1.5-1-3-1.1-4.6-.5zM8 4.8v7.8" {...S} strokeWidth={1.2} />,
  home: <path d="M3.4 7.7L8 3.6l4.6 4.1V12.6H9.7V9.7H6.3v2.9H3.4z" {...F} />,
  star: <path d="M8 2.9l1.5 3.1 3.4.5-2.5 2.4.6 3.4L8 10.7l-3 1.6.6-3.4-2.5-2.4 3.4-.5z" {...F} />,
  bulb: (
    <>
      <path d="M6.2 10.2C5 9.4 4.4 8.2 4.4 7a3.6 3.6 0 0 1 7.2 0c0 1.2-.6 2.4-1.8 3.2v1.2H6.2z" {...F} />
      <path d="M6.4 13h3.2" {...S} />
    </>
  ),
  rocket: <path d="M10.8 3.2c1.4 0 2 .6 2 2 0 2.3-2.1 4.6-4.4 5.9L6.9 9.6l-.5-.5-1-1.5C6.7 5.3 8.5 3.2 10.8 3.2zM5.3 9.2l1.5 1.5-1.9 1.9H3.4v-1.5z" {...F} />,
  // Clapperboard.
  film: <path d="M3.4 6.9h9.2v5a.9.9 0 0 1-.9.9H4.3a.9.9 0 0 1-.9-.9zM3.2 5.3l8.7-1.9.4 1.7-8.7 1.9z" {...F} />,
  tv: (
    <>
      <rect x="3" y="5.6" width="10" height="7" rx="1.2" {...S} strokeWidth={1.3} />
      <path d="M6 3.2l2 2.2 2-2.2" {...S} strokeWidth={1.2} />
    </>
  ),
  // Game controller: the d-pad and the buttons are holes (even-odd fill).
  gamepad: (
    <path
      fillRule="evenodd"
      d="M5.2 4.8h5.6a2.6 2.6 0 0 1 2.5 1.9l.8 3.3a1.5 1.5 0 0 1-2.6 1.3L10.3 10H5.7l-1.2 1.3A1.5 1.5 0 0 1 1.9 10l.8-3.3A2.6 2.6 0 0 1 5.2 4.8zM5 6.3v.9h-.9v1h.9v.9h1v-.9h.9v-1H6v-.9zM10.9 6.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2zM9.8 7.7a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z"
      {...F}
    />
  ),
};

export const TYPE_ICON_KEYS = Object.keys(TYPE_GLYPHS);

export function TypeIcon({ type, size = 16, title }: { type: IssueType | undefined; size?: number; title?: string }) {
  const color = type?.color ?? '#8590A2';
  // Own keys only: an icon name like "__proto__" must not resolve to Object.prototype.
  const glyph = type ? (Object.hasOwn(TYPE_GLYPHS, type.icon) ? TYPE_GLYPHS[type.icon] : undefined) : TYPE_GLYPHS.task;
  return (
    <span className="type-icon" title={title ?? type?.name} style={{ width: size, height: size }}>
      {glyph ? (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <rect width="16" height="16" rx="3" fill={color} />
          {glyph}
        </svg>
      ) : (
        <span className="type-emoji" style={{ fontSize: size * 0.85, background: color }}>
          {type?.icon}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

/** `name`: the level as the board calls it (see priorityLabel()); the generic name by default. */
export function PriorityIcon({ priority, size = 16, name }: { priority: Priority; size?: number; name?: string }) {
  const p = PRIORITIES.find((x) => x.id === priority) ?? PRIORITIES[2];
  const s = { stroke: p.color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  let d: ReactNode;
  switch (priority) {
    case 'highest':
      d = <path d="M4 8.5l4-3.5 4 3.5M4 12.5L8 9l4 3.5" {...s} />;
      break;
    case 'high':
      d = <path d="M4 10.5l4-4 4 4" {...s} />;
      break;
    case 'medium':
      d = <path d="M3.5 6.5h9M3.5 10h9" {...s} />;
      break;
    case 'low':
      d = <path d="M4 6.5l4 4 4-4" {...s} />;
      break;
    case 'lowest':
      d = <path d="M4 4.5L8 8l4-3.5M4 8.5L8 12l4-3.5" {...s} />;
      break;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={name ?? priorityName(p.id)} role="img">
      <title>{name ?? priorityName(p.id)}</title>
      {d}
    </svg>
  );
}
