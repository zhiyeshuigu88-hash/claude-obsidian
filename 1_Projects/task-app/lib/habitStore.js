const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 習慣（繰り返しルール）と実施記録（日付ごと）は tasks とは別のファイルに持つ。
const HABITS_FILE = path.join(__dirname, '..', 'data', 'habits.json');
const LOGS_FILE = path.join(__dirname, '..', 'data', 'habitLogs.json');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function readJson(file) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[]', 'utf-8');
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// --- 日付ユーティリティ（ローカル日付・週は月曜始まり） ---

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftKey(key, days) {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

function mondayOf(key) {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

function todayKey() {
  return dateKey(new Date());
}

function isValidDate(s) {
  return typeof s === 'string' && DATE_RE.test(s) && dateKey(parseKey(s)) === s;
}

// --- 入力の検証 ---

function normalizeHabit(input) {
  const title = String((input && input.title) || '').trim();
  if (!title) return { error: 'title is required' };

  const r = (input && input.repeat) || {};
  let repeat;
  if (r.type === 'days') {
    const days = [...new Set((r.days || []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      .sort((a, b) => a - b);
    if (days.length === 0) return { error: 'days is required' };
    repeat = { type: 'days', days };
  } else if (r.type === 'weekly') {
    const count = Math.round(Number(r.count));
    if (!Number.isFinite(count) || count < 1 || count > 7) return { error: 'count must be between 1 and 7' };
    repeat = { type: 'weekly', count };
  } else {
    repeat = { type: 'daily' };
  }

  const startTime = (input && input.startTime) || null;
  const endTime = (input && input.endTime) || null;
  if (startTime || endTime) {
    if (!TIME_RE.test(startTime || '') || !TIME_RE.test(endTime || '')) {
      return { error: 'startTime and endTime must be HH:MM' };
    }
    if (endTime <= startTime) return { error: 'endTime must be after startTime' };
  }

  return { value: { title, repeat, startTime, endTime } };
}

// --- 判定ロジック ---

// 毎日・曜日指定はその日が対象か。週N回は任意の日に実施できるので常に対象。
function isScheduled(habit, key) {
  if (habit.repeat.type === 'days') return habit.repeat.days.includes(parseKey(key).getDay());
  return true;
}

function logKey(habitId, key) {
  return `${habitId}|${key}`;
}

// 連続日数（毎日・曜日指定）／連続週数（週N回）。今日が未実施でも連続は途切れない。
function streakOf(habit, logSet, today) {
  const has = (k) => logSet.has(logKey(habit.id, k));

  if (habit.repeat.type === 'weekly') {
    const goal = habit.repeat.count;
    const countWeek = (weekStart) => {
      let c = 0;
      for (let i = 0; i < 7; i++) if (has(shiftKey(weekStart, i))) c++;
      return c;
    };
    let weekStart = mondayOf(today);
    let count = countWeek(weekStart) >= goal ? 1 : 0;
    for (let i = 0; i < 100; i++) {
      weekStart = shiftKey(weekStart, -7);
      if (countWeek(weekStart) >= goal) count++;
      else break;
    }
    return { count, unit: 'week' };
  }

  let count = isScheduled(habit, today) && has(today) ? 1 : 0;
  let k = shiftKey(today, -1);
  for (let i = 0; i < 800; i++, k = shiftKey(k, -1)) {
    if (!isScheduled(habit, k)) continue;
    if (has(k)) count++;
    else break;
  }
  return { count, unit: 'day' };
}

// 指定週（月曜始まり）の達成数と目標数。習慣の開始日（作成日か最初の記録日の早い方）より前は目標に含めない。
function weekStatsOf(habit, logSet, weekStart, earliestLogKey) {
  const weekEnd = shiftKey(weekStart, 6);
  const createdKey = dateKey(new Date(habit.createdAt));
  const startKey = earliestLogKey && earliestLogKey < createdKey ? earliestLogKey : createdKey;
  if (startKey > weekEnd) return { done: 0, target: 0, active: false };

  const from = startKey > weekStart ? startKey : weekStart;
  let done = 0;
  let eligible = 0;
  for (let k = from; k <= weekEnd; k = shiftKey(k, 1)) {
    if (!isScheduled(habit, k)) continue;
    eligible++;
    if (logSet.has(logKey(habit.id, k))) done++;
  }
  const target = habit.repeat.type === 'weekly' ? Math.min(habit.repeat.count, eligible) : eligible;
  return { done, target, active: true };
}

function sortHabits(habits) {
  return habits.slice().sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

// --- 公開API ---

function listWithStatus(dateStr) {
  const logs = readJson(LOGS_FILE);
  const logSet = new Set(logs.map((l) => logKey(l.habitId, l.date)));
  const earliest = new Map();
  logs.forEach((l) => {
    if (!earliest.has(l.habitId) || l.date < earliest.get(l.habitId)) earliest.set(l.habitId, l.date);
  });
  const today = todayKey();
  const weekStart = mondayOf(dateStr);
  return sortHabits(readJson(HABITS_FILE)).map((h) => ({
    ...h,
    scheduled: isScheduled(h, dateStr),
    done: logSet.has(logKey(h.id, dateStr)),
    streak: streakOf(h, logSet, today),
    week: weekStatsOf(h, logSet, weekStart, earliest.get(h.id)),
  }));
}

function listLogs(from, to) {
  return readJson(LOGS_FILE).filter((l) => l.date >= from && l.date <= to);
}

function getHabit(id) {
  return readJson(HABITS_FILE).find((h) => h.id === id) || null;
}

function createHabit(input) {
  const n = normalizeHabit(input);
  if (n.error) return n;
  const habits = readJson(HABITS_FILE);
  const habit = { id: crypto.randomUUID(), ...n.value, createdAt: new Date().toISOString() };
  habits.push(habit);
  writeJson(HABITS_FILE, habits);
  return { value: habit };
}

function updateHabit(id, input) {
  const habits = readJson(HABITS_FILE);
  const idx = habits.findIndex((h) => h.id === id);
  if (idx === -1) return { notFound: true };
  const n = normalizeHabit(input);
  if (n.error) return n;
  habits[idx] = { ...habits[idx], ...n.value };
  writeJson(HABITS_FILE, habits);
  return { value: habits[idx] };
}

function deleteHabit(id) {
  writeJson(HABITS_FILE, readJson(HABITS_FILE).filter((h) => h.id !== id));
  writeJson(LOGS_FILE, readJson(LOGS_FILE).filter((l) => l.habitId !== id));
}

function setLog(habitId, date, done) {
  const logs = readJson(LOGS_FILE);
  const idx = logs.findIndex((l) => l.habitId === habitId && l.date === date);
  if (done && idx === -1) logs.push({ habitId, date, doneAt: new Date().toISOString() });
  if (!done && idx !== -1) logs.splice(idx, 1);
  writeJson(LOGS_FILE, logs);
}

module.exports = {
  isValidDate,
  todayKey,
  listWithStatus,
  listLogs,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  setLog,
};
