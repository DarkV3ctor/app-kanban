/**
 * Progress statistics for a day, week, month or year — pure functions (no UI, no i18n), so they
 * can be unit-tested in Node. Everything is computed from the issues' creation and resolution
 * times: an issue counts as completed when it has a resolution time and sits in a "done" column
 * now. Deleted issues are gone from the board and so from the statistics.
 */

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIODS: readonly Period[] = ['day', 'week', 'month', 'year'];

/** The fields of an issue the statistics need. */
export interface ProgressIssue {
  id: string;
  type: string;
  assigneeId: string | null;
  storyPoints: number | null;
  createdAt: number;
  /** Resolution time, or null when the issue is not done. */
  doneAt: number | null;
}

export interface Bucket {
  start: number;
  end: number;
  created: number;
  completed: number;
  points: number;
  /** Totals at the end of the bucket (null for a bucket that has not started yet). */
  scope: number | null;
  done: number | null;
}

export interface PeriodStats {
  start: number;
  end: number;
  buckets: Bucket[];
  created: number;
  completed: number;
  points: number;
  /** Median time from creation to resolution of the issues completed in the period (ms), or null. */
  leadTime: number | null;
  /** Totals at the end of the period (or now, for the current period). */
  scope: number;
  done: number;
  /** Completed issues per type id and per assignee id ('' = unassigned), most first. */
  byType: [string, number][];
  byAssignee: [string, number][];
  /** Ids of the issues completed in the period, latest first. */
  completedIds: string[];
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Start of the period that contains `t` (local time). Weeks start on Monday. */
export function periodStart(period: Period, t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (period === 'month') d.setDate(1);
  else if (period === 'year') d.setMonth(0, 1);
  return d.getTime();
}

/** Start of the period `n` periods after the one starting at `start` (n may be negative). */
export function shiftPeriod(period: Period, start: number, n: number): number {
  const d = new Date(start);
  if (period === 'day') d.setDate(d.getDate() + n);
  else if (period === 'week') d.setDate(d.getDate() + 7 * n);
  else if (period === 'month') d.setMonth(d.getMonth() + n, 1);
  else d.setFullYear(d.getFullYear() + n, 0, 1);
  return d.getTime();
}

/** Bucket boundaries: hours of a day, days of a week or month, months of a year (DST-safe). */
export function bucketStarts(period: Period, start: number): number[] {
  const end = shiftPeriod(period, start, 1);
  const out: number[] = [];
  const d = new Date(start);
  while (d.getTime() < end) {
    out.push(d.getTime());
    if (period === 'day') d.setHours(d.getHours() + 1);
    else if (period === 'year') d.setMonth(d.getMonth() + 1, 1);
    else d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function ranked(counts: Map<string, number>): [string, number][] {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Statistics of the period that starts at `start`; `now` cuts the running totals off at the present. */
export function computeStats(issues: ProgressIssue[], period: Period, start: number, now: number): PeriodStats {
  const end = shiftPeriod(period, start, 1);
  const starts = bucketStarts(period, start);
  const buckets: Bucket[] = starts.map((s, i) => ({ start: s, end: starts[i + 1] ?? end, created: 0, completed: 0, points: 0, scope: null, done: null }));

  const index = (t: number) => {
    // Buckets are few (≤ 31), a linear scan from the end is fine.
    for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start) return i;
    return -1;
  };

  const byType = new Map<string, number>();
  const byAssignee = new Map<string, number>();
  const leadTimes: number[] = [];
  const completed: ProgressIssue[] = [];
  let created = 0;
  let points = 0;

  for (const i of issues) {
    if (i.createdAt >= start && i.createdAt < end) {
      buckets[index(i.createdAt)].created++;
      created++;
    }
    if (i.doneAt !== null && i.doneAt >= start && i.doneAt < end) {
      const b = buckets[index(i.doneAt)];
      b.completed++;
      b.points += i.storyPoints ?? 0;
      points += i.storyPoints ?? 0;
      completed.push(i);
      byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
      byAssignee.set(i.assigneeId ?? '', (byAssignee.get(i.assigneeId ?? '') ?? 0) + 1);
      if (i.doneAt >= i.createdAt) leadTimes.push(i.doneAt - i.createdAt);
    }
  }

  // Running totals at the end of each bucket that has started (sorted sweeps, O(n log n)).
  const createdTimes = issues.map((i) => i.createdAt).sort((a, b) => a - b);
  const doneTimes = issues
    .map((i) => i.doneAt)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  let c = 0;
  let d = 0;
  for (const b of buckets) {
    if (b.start > now) break;
    const cut = Math.min(b.end, now + 1);
    while (c < createdTimes.length && createdTimes[c] < cut) c++;
    while (d < doneTimes.length && doneTimes[d] < cut) d++;
    b.scope = c;
    b.done = d;
  }
  const last = [...buckets].reverse().find((b) => b.scope !== null);

  return {
    start,
    end,
    buckets,
    created,
    completed: completed.length,
    points,
    leadTime: median(leadTimes),
    scope: last?.scope ?? 0,
    done: last?.done ?? 0,
    byType: ranked(byType),
    byAssignee: ranked(byAssignee),
    completedIds: completed.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).map((i) => i.id),
  };
}

/** Completions per calendar day of a year (for the activity heatmap), keyed by the day's start. */
export function dailyCompletions(issues: ProgressIssue[], yearStart: number): Map<number, number> {
  const yearEnd = shiftPeriod('year', yearStart, 1);
  const out = new Map<number, number>();
  for (const i of issues) {
    if (i.doneAt === null || i.doneAt < yearStart || i.doneAt >= yearEnd) continue;
    const day = periodStart('day', i.doneAt);
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** Up to ~5 round tick values from 0 to at least `max` (steps of 1, 2 or 5 × 10ⁿ). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const s = Math.max(1, step);
  const top = Math.ceil(max / s) * s;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += s) ticks.push(Math.round(v));
  return ticks;
}
