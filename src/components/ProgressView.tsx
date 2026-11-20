import { memo, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Issue } from '../types';
import { locale, t, tk } from '../i18n';
import { fieldName, nobodyLabel, pointsAreRating } from '../lib/fields';
import { PERIODS, computeStats, dailyCompletions, niceTicks, periodStart, shiftPeriod, type Bucket, type Period, type ProgressIssue } from '../lib/progress';
import { cls, isDone, monthName, timeAgo } from '../lib/utils';
import { useBoard } from './board-context';
import { Icon, TypeIcon } from './Icons';
import { Avatar, EmptyState, memberOf } from './ui';

/*
 * Progress view: what got done in a day, week, month or year. Stat tiles on top, then a column
 * chart (created vs completed), a burn-up line chart, a year heatmap and breakdowns by type and
 * assignee. Charts are plain SVG drawn from the theme tokens (--chart-created / --chart-done are
 * set per design and mode in styles.css), with hover / keyboard tooltips and a table view.
 */

const PERIOD_NAMES: Record<Period, string> = { day: tk('Day'), week: tk('Week'), month: tk('Month'), year: tk('Year') };
const VS_PREVIOUS: Record<Period, string> = { day: tk('vs previous day'), week: tk('vs previous week'), month: tk('vs previous month'), year: tk('vs previous year') };
const PER_BUCKET: Record<Period, string> = { day: tk('Issues per hour'), week: tk('Issues per day'), month: tk('Issues per day'), year: tk('Issues per month') };
const TABLE_HEAD: Record<Period, string> = { day: tk('Time'), week: tk('Day'), month: tk('Day'), year: tk('Month') };
const PERIOD_KEY = 'kb-progress-period';
const DAY = 86_400_000;

const CREATED = 'var(--chart-created)';
const DONE = 'var(--chart-done)';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtNum = new Intl.NumberFormat(locale);
const fmtDayLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtRange = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
const fmtMonthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
const fmtTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
const fmtMinutes = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short', maximumFractionDigits: 0 });
const fmtHours = new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short', maximumFractionDigits: 1 });
const fmtDays = new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'short', maximumFractionDigits: 1 });

function periodLabel(period: Period, start: number): string {
  const d = new Date(start);
  if (period === 'day') return cap(fmtDayLong.format(d));
  if (period === 'week') return fmtRange.formatRange(d, new Date(shiftPeriod('week', start, 1) - 1));
  if (period === 'month') return `${monthName(d)} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/** Short label under a column: hour, weekday, day of month or month. */
function axisLabel(period: Period, b: Bucket): string {
  const d = new Date(b.start);
  if (period === 'day') return String(d.getHours()).padStart(2, '0');
  if (period === 'week') return cap(fmtWeekday.format(d));
  if (period === 'month') return String(d.getDate());
  return cap(fmtMonthShort.format(d)).replace(/\.$/, '');
}

/** Full label of a bucket (tooltip header, table rows). */
function bucketTitle(period: Period, b: Bucket): string {
  const d = new Date(b.start);
  if (period === 'day') return `${fmtTime.format(d)}–${fmtTime.format(new Date(b.end))}`;
  if (period === 'year') return `${monthName(d)} ${d.getFullYear()}`;
  return cap(fmtDayShort.format(d));
}

function formatDuration(ms: number): string {
  if (ms < 3_600_000) return fmtMinutes.format(Math.max(1, ms / 60_000));
  if (ms < 2 * DAY) return fmtHours.format(ms / 3_600_000);
  return fmtDays.format(ms / DAY);
}

function readPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    if (PERIODS.includes(v as Period)) return v as Period;
  } catch {
    /* ignore */
  }
  return 'week';
}

function savePeriod(p: Period) {
  try {
    localStorage.setItem(PERIOD_KEY, p);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export const ProgressView = memo(function ProgressView() {
  const { board, issues, openIssue } = useBoard();
  const [period, setPeriodState] = useState<Period>(readPeriod);
  const [start, setStart] = useState(() => periodStart(period, Date.now()));

  const items = useMemo<ProgressIssue[]>(
    () =>
      issues.map((i) => ({
        id: i.id,
        type: i.type,
        assigneeId: i.assigneeId,
        storyPoints: i.storyPoints,
        createdAt: i.createdAt,
        doneAt: i.resolvedAt !== null && isDone(board, i) ? i.resolvedAt : null,
      })),
    [issues, board],
  );
  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

  const now = Date.now();
  const current = periodStart(period, now);
  const isCurrent = start === current;
  const stats = useMemo(() => computeStats(items, period, start, Date.now()), [items, period, start]);
  const prev = useMemo(() => computeStats(items, period, shiftPeriod(period, start, -1), Date.now()), [items, period, start]);
  const heat = useMemo(() => (period === 'year' ? dailyCompletions(items, start) : null), [items, period, start]);
  // Ratings (media boards) are not added up.
  const usesPoints = !pointsAreRating(board) && issues.some((i) => i.storyPoints !== null);

  const setPeriod = (p: Period) => {
    // Stay around the time being looked at: the present, or the start of the period on screen.
    setStart(periodStart(p, isCurrent ? now : start));
    setPeriodState(p);
    savePeriod(p);
  };

  if (!issues.length) {
    return (
      <div className="progress-view">
        <div className="view-head">
          <h1>{t('Progress')}</h1>
        </div>
        <EmptyState icon="chart" title={t('No issues yet')}>
          <p className="muted">{t('Charts appear once the board has issues.')}</p>
        </EmptyState>
      </div>
    );
  }

  const typeName = fieldName(board, 'type');
  const assigneeName = fieldName(board, 'assigneeId');
  const pointsName = fieldName(board, 'storyPoints');
  const completedIssues = stats.completedIds.slice(0, 8).map((id) => byId.get(id)!);

  const typeRows = stats.byType.map(([id, n]) => {
    const it = board.issueTypes.find((x) => x.id === id);
    return { key: id, name: it?.name ?? id, icon: <TypeIcon type={it} size={14} />, value: n, color: it?.color ?? 'var(--text-subtlest)' };
  });
  const assigneeRows = stats.byAssignee.map(([id, n]) => {
    const info = memberOf(board, id || null);
    return { key: id || 'none', name: info?.name ?? nobodyLabel(board), icon: <Avatar info={info} size={18} title={info ? undefined : nobodyLabel(board)} />, value: n, color: DONE };
  });

  return (
    <div className="progress-view">
      <div className="view-head">
        <h1>{t('Progress')}</h1>
      </div>

      <div className="progress-toolbar">
        <div className="seg" role="radiogroup" aria-label={t('Period')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === period} className={cls(p === period && 'is-active')} onClick={() => setPeriod(p)}>
              {t(PERIOD_NAMES[p])}
            </button>
          ))}
        </div>
        <div className="period-nav">
          <button type="button" className="icon-btn" onClick={() => setStart(shiftPeriod(period, start, -1))} aria-label={t('Previous period')} title={t('Previous period')}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <span className="period-label" aria-live="polite">
            {periodLabel(period, start)}
          </span>
          <button type="button" className="icon-btn" onClick={() => setStart(shiftPeriod(period, start, 1))} disabled={shiftPeriod(period, start, 1) > now} aria-label={t('Next period')} title={t('Next period')}>
            <Icon name="chevronRight" size={18} />
          </button>
          {!isCurrent && (
            <button type="button" className="btn btn-subtle btn-sm" onClick={() => setStart(current)}>
              {t('Today')}
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <StatTile hero label={t('Completed')} value={stats.completed} delta={stats.completed - prev.completed} goodWhenUp vs={t(VS_PREVIOUS[period])} />
        <StatTile label={t('Created')} value={stats.created} delta={stats.created - prev.created} vs={t(VS_PREVIOUS[period])} />
        <StatTile label={t('Median lead time')} text={stats.leadTime === null ? '—' : formatDuration(stats.leadTime)} note={t('from creation to done')} />
        {usesPoints && <StatTile label={t('{field} completed', { field: pointsName })} value={stats.points} delta={stats.points - prev.points} goodWhenUp vs={t(VS_PREVIOUS[period])} />}
        <CompletionTile done={stats.done} scope={stats.scope} current={isCurrent} />
      </div>

      <div className="chart-grid">
        <ChartCard
          title={t('Created and completed')}
          subtitle={t(PER_BUCKET[period])}
          legend={
            <>
              <LegendItem color={CREATED} label={t('Created')} />
              <LegendItem color={DONE} label={t('Completed')} />
            </>
          }
          table={<BucketTable period={period} buckets={stats.buckets} cols={[[t('Created'), (b) => b.created], [t('Completed'), (b) => b.completed]]} />}
        >
          <ColumnChart period={period} buckets={stats.buckets} now={now} />
        </ChartCard>
        <ChartCard
          title={t('Burn-up')}
          subtitle={t('All issues on the board and how many of them are done')}
          legend={
            <>
              <LegendItem color={CREATED} label={t('All issues')} line />
              <LegendItem color={DONE} label={t('Done')} line />
            </>
          }
          table={<BucketTable period={period} buckets={stats.buckets} cols={[[t('All issues'), (b) => b.scope], [t('Done'), (b) => b.done]]} />}
        >
          <BurnupChart period={period} buckets={stats.buckets} now={now} />
        </ChartCard>
      </div>

      {heat && (
        <ChartCard title={t('Activity')} subtitle={t('Issues completed per day')} className="chart-card-wide">
          <YearHeatmap counts={heat} yearStart={start} now={now} />
        </ChartCard>
      )}

      <div className="chart-grid chart-grid-3">
        <ChartCard title={typeName} subtitle={t('Completed in this period')}>
          <BarList rows={typeRows} empty={t('Nothing completed in this period')} />
        </ChartCard>
        <ChartCard title={assigneeName} subtitle={t('Completed in this period')}>
          <BarList rows={assigneeRows} empty={t('Nothing completed in this period')} />
        </ChartCard>
        <ChartCard title={t('Recently completed')}>
          {completedIssues.length ? (
            <div className="progress-done-list">
              {completedIssues.map((i) => (
                <DoneRow key={i.id} issue={i} onOpen={() => openIssue(i)} />
              ))}
            </div>
          ) : (
            <div className="muted small">{t('Nothing completed in this period')}</div>
          )}
        </ChartCard>
      </div>

      <p className="muted small progress-note">
        {t('Counted from when issues were created and resolved. Deleted issues are not counted; an issue moved back out of a "done" column counts again once it is done again.')}
      </p>
    </div>
  );
});

function DoneRow({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  const { board } = useBoard();
  return (
    <button type="button" className="done-row" onClick={onOpen}>
      <TypeIcon type={board.issueTypes.find((x) => x.id === issue.type)} size={14} />
      <span className="done-row-key">
        {board.key}-{issue.number}
      </span>
      <span className="done-row-title">{issue.title}</span>
      <span className="muted small done-row-time">{issue.resolvedAt ? timeAgo(issue.resolvedAt) : ''}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  text,
  delta,
  vs,
  note,
  goodWhenUp,
  hero,
}: {
  label: string;
  value?: number;
  text?: string;
  delta?: number;
  vs?: string;
  note?: string;
  goodWhenUp?: boolean;
  hero?: boolean;
}) {
  const dir = delta === undefined || delta === 0 ? 0 : delta > 0 ? 1 : -1;
  // Colour = direction × whether up is good; "Created" has no good direction and stays neutral.
  const tone = dir === 0 || !goodWhenUp ? 'neutral' : dir > 0 ? 'good' : 'bad';
  return (
    <div className={cls('stat-tile', hero && 'is-hero')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{text ?? fmtNum.format(value ?? 0)}</div>
      {delta !== undefined ? (
        <div className={cls('stat-delta', `is-${tone}`)}>
          {dir !== 0 && <Icon name={dir > 0 ? 'arrowUp' : 'arrowDown'} size={12} />}
          <b>{dir > 0 ? `+${fmtNum.format(delta)}` : fmtNum.format(delta)}</b> <span>{vs}</span>
        </div>
      ) : (
        note && <div className="stat-delta is-neutral">{note}</div>
      )}
    </div>
  );
}

/** Share of all issues that are done, at the end of the period: a ring meter. */
function CompletionTile({ done, scope, current }: { done: number; scope: number; current: boolean }) {
  const share = scope ? done / scope : 0;
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="stat-tile stat-tile-ring">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={t('{done} of {total} issues done', { done, total: scope })}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="8" />
        {done > 0 && (
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={DONE}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${share * c} ${c}`}
            transform="rotate(-90 32 32)"
          />
        )}
      </svg>
      <div>
        <div className="stat-label">{current ? t('Done now') : t('Done by the end')}</div>
        <div className="stat-value">{Math.round(share * 100)}%</div>
        <div className="stat-delta is-neutral">{t('{done} of {total} issues', { done: fmtNum.format(done), total: fmtNum.format(scope) })}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart chrome
// ---------------------------------------------------------------------------

function ChartCard({ title, subtitle, legend, table, className, children }: { title: string; subtitle?: string; legend?: ReactNode; table?: ReactNode; className?: string; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cls('chart-card', className)}>
      <header className="chart-card-head">
        <div className="chart-card-titles">
          <h2 className="chart-title">{title}</h2>
          {subtitle && <div className="chart-subtitle">{subtitle}</div>}
        </div>
        {table && (
          <button type="button" className={cls('icon-btn', asTable && 'is-active')} aria-pressed={asTable} onClick={() => setAsTable(!asTable)} title={asTable ? t('Show as chart') : t('Show as table')} aria-label={t('Show as table')}>
            <Icon name={asTable ? 'chart' : 'table'} size={16} />
          </button>
        )}
      </header>
      {legend && !asTable && <div className="chart-legend">{legend}</div>}
      {asTable ? table : children}
    </section>
  );
}

/** A legend key mirrors its mark: a square for columns, a short line for lines. */
function LegendItem({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="legend-item">
      <span className={line ? 'legend-line' : 'legend-swatch'} style={{ background: color }} />
      {label}
    </span>
  );
}

function BucketTable({ period, buckets, cols }: { period: Period; buckets: Bucket[]; cols: [string, (b: Bucket) => number | null][] }) {
  return (
    <div className="table-scroll chart-table-wrap">
      <table className="chart-table">
        <thead>
          <tr>
            <th>{t(TABLE_HEAD[period])}</th>
            {cols.map(([name]) => (
              <th key={name} className="num">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start}>
              <td>{bucketTitle(period, b)}</td>
              {cols.map(([name, get]) => {
                const v = get(b);
                return (
                  <td key={name} className="num">
                    {v === null ? '—' : fmtNum.format(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Width of an element, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Arrow keys move the highlighted column while the chart has focus. */
function useActive(n: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in keys) {
      e.preventDefault();
      setActive((a) => Math.min(n - 1, Math.max(0, (a ?? (keys[e.key] > 0 ? -1 : n)) + keys[e.key])));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : n - 1);
    } else if (e.key === 'Escape') setActive(null);
  };
  return { active, setActive, onKeyDown };
}

function Tooltip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { color: string; value: string; name: string }[] }) {
  const right = x > width / 2;
  return (
    <div className={cls('chart-tooltip', right && 'is-left')} style={{ left: right ? x - 10 : x + 10 }} role="status">
      <div className="tt-title">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="tt-row">
          <span className="tt-key" style={{ background: r.color }} />
          <b>{r.value}</b>
          <span>{r.name}</span>
        </div>
      ))}
    </div>
  );
}

const H = 220;
const M = { top: 14, right: 14, bottom: 26, left: 34 };

/** Y axis: hairline gridlines with round tick values. */
function YGrid({ ticks, y, width }: { ticks: number[]; y: (v: number) => number; width: number }) {
  return (
    <g className="chart-grid-lines">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart-baseline' : undefined} />
          <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="chart-tick">
            {fmtNum.format(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ period, buckets, x, now }: { period: Period; buckets: Bucket[]; x: (i: number) => number; now: number }) {
  const plotW = x(buckets.length - 1) - x(0) || 1;
  const fit = Math.max(1, Math.floor(plotW / 34) + 1);
  const step = Math.max(1, Math.ceil(buckets.length / fit));
  return (
    <g>
      {buckets.map((b, i) =>
        i % step === 0 ? (
          <text key={b.start} x={x(i)} y={H - 8} textAnchor="middle" className={cls('chart-tick', now >= b.start && now < b.end && 'is-now')}>
            {axisLabel(period, b)}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** A column with a 4 px rounded data end, square at the baseline. */
function columnPath(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const top = base - h;
  return `M${x},${base}V${top + r}A${r},${r} 0 0 1 ${x + r},${top}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${top + r}V${base}Z`;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/** Created and completed issues per bucket, as paired columns. */
function ColumnChart({ period, buckets, now }: { period: Period; buckets: Bucket[]; now: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = buckets.length;
  const { active, setActive, onKeyDown } = useActive(n);
  const plotW = Math.max(1, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.created, b.completed)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const band = plotW / n;
  const gap = band > 12 ? 2 : 1;
  const barW = Math.max(1, Math.min(24, (band * 0.76 - gap) / 2));
  const groupW = barW * 2 + gap;
  const cx = (i: number) => M.left + band * (i + 0.5);
  const series = [
    { key: 'created' as const, color: CREATED, name: t('Created') },
    { key: 'completed' as const, color: DONE, name: t('Completed') },
  ];

  return (
    <div ref={ref} className="chart" tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)} aria-label={t('Created and completed')}>
      {width > 0 && (
        <svg width={width} height={H} onPointerLeave={() => setActive(null)} aria-hidden="true">
          <YGrid ticks={ticks} y={y} width={width} />
          {active !== null && <rect x={M.left + band * active} y={M.top} width={band} height={plotH} className="chart-hover-band" />}
          {buckets.map((b, i) => {
            const x0 = cx(i) - groupW / 2;
            return (
              <g key={b.start} className={cls('chart-cols', active !== null && active !== i && 'is-dim')}>
                {series.map((s, j) => {
                  const v = b[s.key];
                  if (!v) return null;
                  return <path key={s.key} d={columnPath(x0 + j * (barW + gap), y(0), barW, y(0) - y(v))} fill={s.color} />;
                })}
              </g>
            );
          })}
          <XLabels period={period} buckets={buckets} x={cx} now={now} />
          {buckets.map((b, i) => (
            <rect key={b.start} x={M.left + band * i} y={M.top} width={band} height={plotH + M.bottom} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
          ))}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          x={cx(active)}
          width={width}
          title={bucketTitle(period, buckets[active])}
          rows={series.map((s) => ({ color: s.color, value: fmtNum.format(buckets[active][s.key]), name: s.name }))}
        />
      )}
    </div>
  );
}

/** All issues (scope) and done issues at the end of each bucket — the gap between them is the work left. */
function BurnupChart({ period, buckets, now }: { period: Period; buckets: Bucket[]; now: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = buckets.length;
  const { active, setActive, onKeyDown } = useActive(n);
  const right = M.right + 22; // room for the end labels
  const plotW = Math.max(1, width - M.left - right);
  const plotH = H - M.top - M.bottom;
  const max = Math.max(1, ...buckets.map((b) => b.scope ?? 0));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const known = buckets.map((b, i) => ({ i, scope: b.scope, done: b.done })).filter((p): p is { i: number; scope: number; done: number } => p.scope !== null && p.done !== null);
  const line = (k: 'scope' | 'done') => known.map((p, j) => `${j ? 'L' : 'M'}${x(p.i)},${y(p[k])}`).join('');
  const area = known.length ? `${line('done')}L${x(known[known.length - 1].i)},${y(0)}L${x(known[0].i)},${y(0)}Z` : '';
  const last = known[known.length - 1];
  // End labels only when they do not collide; otherwise the legend and the tooltip carry the values.
  const labelsFit = last && Math.abs(y(last.scope) - y(last.done)) >= 14;
  const shown = active !== null ? known.find((p) => p.i === active) : undefined;

  return (
    <div ref={ref} className="chart" tabIndex={0} onKeyDown={onKeyDown} onBlur={() => setActive(null)} aria-label={t('Burn-up')}>
      {width > 0 && (
        <svg width={width} height={H} onPointerLeave={() => setActive(null)} aria-hidden="true">
          <g className="chart-grid-lines">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={width - right} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart-baseline' : undefined} />
                <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="chart-tick">
                  {fmtNum.format(v)}
                </text>
              </g>
            ))}
          </g>
          {known.length > 0 && (
            <>
              <path d={area} fill={DONE} opacity={0.12} />
              <path d={line('scope')} fill="none" stroke={CREATED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <path d={line('done')} fill="none" stroke={DONE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {shown && <line x1={x(shown.i)} x2={x(shown.i)} y1={M.top} y2={y(0)} className="chart-crosshair" />}
          {(shown ?? last) && (
            <>
              <circle cx={x((shown ?? last).i)} cy={y((shown ?? last).scope)} r={4} fill={CREATED} className="chart-dot" />
              <circle cx={x((shown ?? last).i)} cy={y((shown ?? last).done)} r={4} fill={DONE} className="chart-dot" />
            </>
          )}
          {!shown && labelsFit && (
            <>
              <text x={x(last.i) + 8} y={y(last.scope)} dy="0.32em" className="chart-end-label">
                {fmtNum.format(last.scope)}
              </text>
              <text x={x(last.i) + 8} y={y(last.done)} dy="0.32em" className="chart-end-label">
                {fmtNum.format(last.done)}
              </text>
            </>
          )}
          <XLabels period={period} buckets={buckets} x={x} now={now} />
          {buckets.map((b, i) => {
            const w = n === 1 ? plotW : plotW / (n - 1);
            return <rect key={b.start} x={x(i) - w / 2} y={M.top} width={w} height={plotH + M.bottom} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />;
          })}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          x={x(active)}
          width={width}
          title={bucketTitle(period, buckets[active])}
          rows={
            shown
              ? [
                  { color: CREATED, value: fmtNum.format(shown.scope), name: t('All issues') },
                  { color: DONE, value: fmtNum.format(shown.done), name: t('Done') },
                  { color: 'var(--chart-track)', value: fmtNum.format(shown.scope - shown.done), name: t('Left') },
                ]
              : [{ color: 'var(--chart-track)', value: '—', name: t('Not yet') }]
          }
        />
      )}
    </div>
  );
}

/** Completions per day over a year: weeks are columns (Monday on top), five steps of one hue. */
function YearHeatmap({ counts, yearStart, now }: { counts: Map<number, number>; yearStart: number; now: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ day: number; x: number } | null>(null);
  const first = periodStart('week', yearStart);
  const yearEnd = shiftPeriod('year', yearStart, 1);
  const days: { start: number; col: number; row: number; count: number }[] = [];
  for (let d = new Date(yearStart); d.getTime() < yearEnd; d.setDate(d.getDate() + 1)) {
    const s = d.getTime();
    const offset = Math.round((s - first) / DAY);
    days.push({ start: s, col: Math.floor(offset / 7), row: (d.getDay() + 6) % 7, count: counts.get(s) ?? 0 });
  }
  const cols = days[days.length - 1].col + 1;
  const left = 30;
  const topPad = 18;
  const gap = 3;
  const cell = Math.max(9, Math.min(16, Math.floor((width - left) / cols) - gap));
  const svgW = left + cols * (cell + gap);
  const svgH = topPad + 7 * (cell + gap);
  const max = Math.max(0, ...counts.values());
  const level = (n: number) => (n === 0 ? 0 : Math.max(1, Math.ceil((n / max) * 4)));
  const today = periodStart('day', now);
  const months = days.filter((d) => new Date(d.start).getDate() === 1);
  const weekdays = [0, 2, 4].map((row) => ({ row, label: cap(fmtWeekday.format(new Date(first + row * DAY))) }));
  const hovered = hover ? days.find((d) => d.start === hover.day) : undefined;
  const todayCol = days.find((d) => d.start === today)?.col;

  // On a narrow screen the year scrolls sideways: start with today (or the year's end) in view.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const col = todayCol ?? cols - 1;
    el.scrollLeft = left + col * (cell + gap) - el.clientWidth / 2;
  }, [todayCol, cols, cell, width]);

  return (
    <div ref={ref} className="chart heatmap" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <div ref={scroller} className="heatmap-scroll">
          <svg width={svgW} height={svgH} role="img" aria-label={t('Issues completed per day')}>
            {months.map((m) => (
              <text key={m.start} x={left + m.col * (cell + gap)} y={11} className="chart-tick">
                {cap(fmtMonthShort.format(new Date(m.start))).replace(/\.$/, '')}
              </text>
            ))}
            {weekdays.map((w) => (
              <text key={w.row} x={left - 6} y={topPad + w.row * (cell + gap) + cell / 2} dy="0.32em" textAnchor="end" className="chart-tick">
                {w.label}
              </text>
            ))}
            {days.map((d) => (
              <rect
                key={d.start}
                x={left + d.col * (cell + gap)}
                y={topPad + d.row * (cell + gap)}
                width={cell}
                height={cell}
                rx={2}
                className={cls('heat-cell', `heat-${level(d.count)}`, d.start > now && 'is-future', d.start === today && 'is-today')}
                onPointerEnter={(e) => {
                  // Relative to the chart, so the tooltip follows the cell when the map is scrolled sideways.
                  const r = e.currentTarget.getBoundingClientRect();
                  const base = ref.current!.getBoundingClientRect();
                  setHover({ day: d.start, x: r.left + r.width / 2 - base.left });
                }}
              />
            ))}
          </svg>
        </div>
      )}
      <div className="heatmap-legend">
        <span>{t('Less')}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heat-swatch heat-${l}`} />
        ))}
        <span>{t('More')}</span>
      </div>
      {hovered && hover && (
        <Tooltip x={Math.min(hover.x, width)} width={width} title={cap(fmtDayLong.format(new Date(hovered.start)))} rows={[{ color: DONE, value: fmtNum.format(hovered.count), name: t('Completed') }]} />
      )}
    </div>
  );
}

/** Horizontal bars, longest first; the rest fold into "Other" after six rows. */
function BarList({ rows, empty }: { rows: { key: string; name: string; icon: ReactNode; value: number; color: string }[]; empty: string }) {
  if (!rows.length) return <div className="muted small">{empty}</div>;
  const shown = rows.length > 7 ? [...rows.slice(0, 6), { key: '__other', name: t('Other'), icon: null, value: rows.slice(6).reduce((s, r) => s + r.value, 0), color: 'var(--text-subtlest)' }] : rows;
  const max = Math.max(...shown.map((r) => r.value));
  return (
    <div className="bar-list">
      {shown.map((r) => (
        <div key={r.key} className="bar-row">
          <span className="bar-name">
            {r.icon}
            <span className="bar-name-text">{r.name}</span>
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="bar-value">{fmtNum.format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
