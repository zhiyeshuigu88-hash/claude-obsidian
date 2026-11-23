const test = require('node:test');
const assert = require('node:assert');
const { computeBreakdown } = require('../lib/breakdown');

const now = new Date(2026, 10, 15, 12, 0, 0); // 2026-11-15 12:00（ローカル）
const base = { sessions: [], habits: [], logs: [], boxes: [], tasks: [], from: '2026-11-09', to: '2026-11-15', now };
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const habit = { id: 'h1', title: '読書', startTime: '21:30', endTime: '22:00' };

test('何も記録がなければ 0', () => {
  const r = computeBreakdown(base);
  assert.deepStrictEqual(r.parts, { task: 0, habit: 0, free: 0, break: 0 });
  assert.strictEqual(r.totalSeconds, 0);
});

test('タイマーなしでも、達成した習慣は時間帯の長さを数える', () => {
  const r = computeBreakdown({ ...base, habits: [habit], logs: [{ habitId: 'h1', date: '2026-11-10' }, { habitId: 'h1', date: '2026-11-11' }] });
  assert.strictEqual(r.parts.habit, 2 * 30 * 60);
  assert.strictEqual(r.measuredSeconds, 0);
  assert.strictEqual(r.estimatedSeconds, 3600);
});

test('達成していない日・期間外・時間帯なしの習慣は数えない', () => {
  const noTime = { id: 'h2', title: '瞑想', startTime: null, endTime: null };
  const r = computeBreakdown({ ...base, habits: [habit, noTime], logs: [{ habitId: 'h1', date: '2026-11-01' }, { habitId: 'h2', date: '2026-11-10' }] });
  assert.strictEqual(r.parts.habit, 0);
});

test('同じ日にタイマーの記録もあるときは、長いほうだけ（二重に数えない）', () => {
  const sessions = [{ type: 'work', habitId: 'h1', startTime: at(10, 21, 30), duration: 40 * 60 }];
  const r = computeBreakdown({ ...base, habits: [habit], logs: [{ habitId: 'h1', date: '2026-11-10' }], sessions });
  assert.strictEqual(r.parts.habit, 40 * 60); // 予定 30 分 < 実測 40 分
  assert.strictEqual(r.estimatedSeconds, 0);

  const short = [{ type: 'work', habitId: 'h1', startTime: at(10, 21, 30), duration: 10 * 60 }];
  const r2 = computeBreakdown({ ...base, habits: [habit], logs: [{ habitId: 'h1', date: '2026-11-10' }], sessions: short });
  assert.strictEqual(r2.parts.habit, 30 * 60); // 予定 30 分 > 実測 10 分
  assert.strictEqual(r2.measuredSeconds, 600);
  assert.strictEqual(r2.estimatedSeconds, 20 * 60);
});

test('時間枠は、過ぎた分だけを数える', () => {
  const boxes = [
    { taskId: 't1', startTime: at(10, 9), endTime: at(10, 11) }, // 過去: 2 時間
    { taskId: 't1', startTime: at(15, 11), endTime: at(15, 14) }, // 今日 11〜14 時のうち 11〜12 時の 1 時間
    { taskId: 't1', startTime: at(15, 15), endTime: at(15, 16) }, // まだ先
  ];
  const r = computeBreakdown({ ...base, boxes });
  assert.strictEqual(r.parts.task, 3 * 3600);
});

test('時間枠もタイマーもない完了タスクは、完了した日に見積時間を数える', () => {
  const tasks = [
    { id: 't1', status: 'done', estimateMinutes: 30, updatedAt: at(12, 8) },
    { id: 't2', status: 'todo', estimateMinutes: 60, updatedAt: at(12, 8) }, // 未完了
    { id: 't3', status: 'done', estimateMinutes: null, updatedAt: at(12, 8) }, // 見積なし
    { id: 't4', status: 'done', estimateMinutes: 45, updatedAt: at(1, 8) }, // 期間外
    { id: 't5', status: 'done', estimateMinutes: 20, updatedAt: at(12, 8), parentTaskId: 't1' }, // サブタスク
  ];
  const r = computeBreakdown({ ...base, tasks });
  assert.strictEqual(r.parts.task, 30 * 60);
});

test('タイマーや時間枠があるタスクは、見積時間を足さない', () => {
  const tasks = [{ id: 't1', status: 'done', estimateMinutes: 60, updatedAt: at(12, 8) }];
  const sessions = [{ type: 'work', taskId: 't1', startTime: at(12, 9), duration: 25 * 60 }];
  const r = computeBreakdown({ ...base, tasks, sessions });
  assert.strictEqual(r.parts.task, 25 * 60);
  assert.strictEqual(r.estimatedSeconds, 0);
});

test('休憩と紐付けなしはタイマーの実測だけ', () => {
  const sessions = [
    { type: 'break', startTime: at(10, 10), duration: 300 },
    { type: 'work', startTime: at(10, 10, 5), duration: 1500 },
  ];
  const r = computeBreakdown({ ...base, sessions });
  assert.strictEqual(r.parts.break, 300);
  assert.strictEqual(r.parts.free, 1500);
  assert.strictEqual(r.measuredSeconds, 1800);
  assert.strictEqual(r.totalSeconds, 1800);
});
