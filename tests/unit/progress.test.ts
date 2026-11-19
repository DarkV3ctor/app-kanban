import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketStarts, computeStats, dailyCompletions, niceTicks, periodStart, shiftPeriod, type ProgressIssue } from '../../src/lib/progress.ts';

// All dates are local time, so the tests pass in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

let seq = 0;
function issue(over: Partial<ProgressIssue>): ProgressIssue {
  return { id: `i${++seq}`, type: 'task', assigneeId: null, storyPoints: null, createdAt: at(2026, 1, 1), doneAt: null, ...over };
}

test('periods start at midnight, on Monday, on the 1st and on January 1st', () => {
  const t = at(2026, 11, 19, 15, 30); // a Thursday
  assert.equal(periodStart('day', t), at(2026, 11, 19));
  assert.equal(periodStart('week', t), at(2026, 11, 16));
  assert.equal(periodStart('week', at(2026, 11, 22, 23)), at(2026, 11, 16)); // Sunday belongs to the same week
  assert.equal(periodStart('month', t), at(2026, 11, 1));
  assert.equal(periodStart('year', t), at(2026, 1, 1));
});

test('periods shift by calendar units', () => {
  assert.equal(shiftPeriod('day', at(2026, 2, 28), 1), at(2026, 3, 1));
  assert.equal(shiftPeriod('week', at(2026, 11, 16), -1), at(2026, 11, 9));
  assert.equal(shiftPeriod('month', at(2026, 1, 1), 1), at(2026, 2, 1));
  assert.equal(shiftPeriod('month', at(2026, 1, 1), -1), at(2025, 12, 1));
  assert.equal(shiftPeriod('year', at(2026, 1, 1), 1), at(2027, 1, 1));
});

test('buckets: 24 hours, 7 days, the days of the month, 12 months', () => {
  assert.equal(bucketStarts('day', at(2026, 11, 19)).length, 24);
  assert.equal(bucketStarts('week', at(2026, 11, 16)).length, 7);
  assert.equal(bucketStarts('month', at(2026, 2, 1)).length, 28);
  assert.equal(bucketStarts('month', at(2028, 2, 1)).length, 29);
  assert.equal(bucketStarts('month', at(2026, 11, 1)).length, 30);
  assert.equal(bucketStarts('year', at(2026, 1, 1)).length, 12);
});

test('created and completed are counted per bucket, with points, types and assignees', () => {
  const week = at(2026, 11, 16);
  const issues = [
    issue({ createdAt: at(2026, 11, 16, 9), doneAt: at(2026, 11, 17, 9), storyPoints: 3, type: 'bug', assigneeId: 'a' }),
    issue({ createdAt: at(2026, 11, 10), doneAt: at(2026, 11, 17, 18), storyPoints: 2, assigneeId: 'a' }),
    issue({ createdAt: at(2026, 11, 18, 12) }),
    issue({ createdAt: at(2026, 11, 1), doneAt: at(2026, 11, 12) }), // done the week before
  ];
  const s = computeStats(issues, 'week', week, at(2026, 11, 22, 23));
  assert.equal(s.created, 2);
  assert.equal(s.completed, 2);
  assert.equal(s.points, 5);
  assert.deepEqual(
    s.buckets.map((b) => b.created),
    [1, 0, 1, 0, 0, 0, 0],
  );
  assert.deepEqual(
    s.buckets.map((b) => b.completed),
    [0, 2, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(s.byType, [
    ['bug', 1],
    ['task', 1],
  ]);
  assert.deepEqual(s.byAssignee, [['a', 2]]);
  assert.deepEqual(s.completedIds, [issues[1].id, issues[0].id]); // latest first
  // Median of 24 h and 7 d 18 h.
  assert.equal(s.leadTime, (24 * 3600_000 + (7 * 24 + 18) * 3600_000) / 2);
});

test('burn-up totals run up to the present and stop there', () => {
  const week = at(2026, 11, 16);
  const issues = [
    issue({ createdAt: at(2026, 11, 1), doneAt: at(2026, 11, 12) }),
    issue({ createdAt: at(2026, 11, 16, 9), doneAt: at(2026, 11, 17, 9) }),
    issue({ createdAt: at(2026, 11, 18, 12) }),
  ];
  const s = computeStats(issues, 'week', week, at(2026, 11, 18, 15)); // Wednesday afternoon
  assert.deepEqual(
    s.buckets.map((b) => b.scope),
    [2, 2, 3, null, null, null, null],
  );
  assert.deepEqual(
    s.buckets.map((b) => b.done),
    [1, 2, 2, null, null, null, null],
  );
  assert.equal(s.scope, 3);
  assert.equal(s.done, 2);
});

test('an empty period has no lead time and zero counts', () => {
  const s = computeStats([issue({ createdAt: at(2020, 1, 1) })], 'day', at(2026, 11, 19), at(2026, 11, 19, 12));
  assert.equal(s.completed, 0);
  assert.equal(s.created, 0);
  assert.equal(s.leadTime, null);
  assert.equal(s.scope, 1);
});

test('daily completions of a year are keyed by the start of the day', () => {
  const issues = [
    issue({ doneAt: at(2026, 3, 5, 10) }),
    issue({ doneAt: at(2026, 3, 5, 22) }),
    issue({ doneAt: at(2025, 12, 31, 23) }), // last year
  ];
  const m = dailyCompletions(issues, at(2026, 1, 1));
  assert.equal(m.size, 1);
  assert.equal(m.get(at(2026, 3, 5)), 2);
});

test('ticks are round and cover the maximum', () => {
  assert.deepEqual(niceTicks(0), [0, 1]);
  assert.deepEqual(niceTicks(3), [0, 1, 2, 3]);
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(48), [0, 20, 40, 60]);
  for (const max of [1, 5, 13, 99, 250, 1234]) {
    const ticks = niceTicks(max);
    assert.ok(ticks[ticks.length - 1] >= max, `top tick covers ${max}`);
    assert.ok(ticks.length <= 7, `few ticks for ${max}`);
  }
});
