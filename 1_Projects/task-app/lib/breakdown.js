// 直近 days 日の「時間の内訳」。
// タイマー（ポモドーロ）の記録を実測として使い、タイマーを使わなかった分は予定した時間から見積もって足す。
//   - 習慣: 達成にチェックした日の、習慣の時間帯（開始〜終了）の長さ
//   - タスク: 時間枠のうち、すでに過ぎた分。時間枠もタイマーもないタスクは、完了した日に見積時間（estimateMinutes）
// 同じ日・同じ習慣（タスク）にタイマーの記録もある場合は、長いほうだけを数える（二重に数えない）。
// 休憩と「紐付けなし」は、タイマーを使わないと分からないので実測だけ。

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clockMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function addTo(map, key, seconds) {
  map.set(key, (map.get(key) || 0) + seconds);
}

// sessions: ポモドーロの記録 / habits: 習慣の定義 / logs: 習慣の達成記録 / boxes: 時間枠 / tasks: タスク
// from, to: 集計する期間（日付キー YYYY-MM-DD、両端を含む）/ now: 現在時刻
function computeBreakdown({ sessions, habits, logs, boxes, tasks, from, to, now }) {
  const inRange = (key) => key >= from && key <= to;

  const parts = { task: 0, habit: 0, free: 0, break: 0 };
  const habitRecorded = new Map(); // 「習慣ID|日付」→ タイマーの秒数
  const taskRecorded = new Map(); // 「タスクID|日付」→ タイマーの秒数
  const taskIdsWithRecords = new Set();

  // 1. タイマーの記録（実測）
  let measured = 0;
  for (const s of sessions) {
    const sec = s.duration || 0;
    const day = dateKey(new Date(s.startTime));
    measured += sec;
    if (s.type === 'break') parts.break += sec;
    else if (s.habitId) addTo(habitRecorded, `${s.habitId}|${day}`, sec);
    else if (s.taskId) {
      addTo(taskRecorded, `${s.taskId}|${day}`, sec);
      taskIdsWithRecords.add(s.taskId);
    } else parts.free += sec;
  }

  // 2. 習慣: 達成した日は、時間帯の長さと記録の長いほうを数える。達成の記録がない日のタイマー記録もそのまま数える
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const habitDays = new Set([...habitRecorded.keys()]);
  const habitPlanned = new Map();
  for (const l of logs) {
    const h = habitById.get(l.habitId);
    if (!h || !inRange(l.date)) continue;
    const key = `${l.habitId}|${l.date}`;
    habitDays.add(key);
    if (h.startTime && h.endTime) habitPlanned.set(key, (clockMinutes(h.endTime) - clockMinutes(h.startTime)) * 60);
  }
  for (const key of habitDays) {
    parts.habit += Math.max(habitPlanned.get(key) || 0, habitRecorded.get(key) || 0);
  }

  // 3. タスク: 時間枠のうち過ぎた分と、タイマーの記録の長いほう
  const boxElapsed = new Map();
  const taskIdsWithBoxes = new Set();
  for (const b of boxes) {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const elapsed = Math.round((Math.min(end, now) - start) / 1000);
    const id = b.taskId || '';
    taskIdsWithBoxes.add(id);
    if (elapsed > 0) addTo(boxElapsed, `${id}|${dateKey(start)}`, elapsed);
  }
  const taskDays = new Set([...taskRecorded.keys(), ...boxElapsed.keys()]);
  for (const key of taskDays) {
    parts.task += Math.max(boxElapsed.get(key) || 0, taskRecorded.get(key) || 0);
  }

  // 4. 時間枠もタイマーもないタスクは、完了した日に見積時間を数える
  for (const t of tasks) {
    if (t.status !== 'done' || !t.estimateMinutes || t.parentTaskId) continue;
    if (taskIdsWithBoxes.has(t.id) || taskIdsWithRecords.has(t.id)) continue;
    if (!inRange(dateKey(new Date(t.updatedAt)))) continue;
    parts.task += t.estimateMinutes * 60;
  }

  const totalSeconds = parts.task + parts.habit + parts.free + parts.break;
  return {
    totalSeconds,
    parts,
    measuredSeconds: measured,
    estimatedSeconds: Math.max(0, totalSeconds - measured),
  };
}

// 保存データから集めて計算する
function summarizeBreakdown(days, now = new Date()) {
  const pomodoroStore = require('./pomodoroStore');
  const habitStore = require('./habitStore');
  const timeboxStore = require('./timeboxStore');
  const taskStore = require('./taskStore');

  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  const from = dateKey(start);
  const to = dateKey(now);

  return computeBreakdown({
    sessions: pomodoroStore.listRecentSessions(days),
    habits: habitStore.listWithStatus(to),
    logs: habitStore.listLogs(from, to),
    boxes: timeboxStore.listForRange(from, to),
    tasks: taskStore.listTasks(),
    from,
    to,
    now,
  });
}

module.exports = { computeBreakdown, summarizeBreakdown };
