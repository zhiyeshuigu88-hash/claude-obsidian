const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'sessions.json');

function ensureFile() {
  if (fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(sessions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function recordSession({ taskId, startTime, endTime, duration, type }) {
  const sessions = readAll();
  const session = {
    id: crypto.randomUUID(),
    taskId: taskId || null,
    startTime,
    endTime,
    duration,
    type,
    createdAt: new Date().toISOString(),
  };
  sessions.push(session);
  writeAll(sessions);
  return session;
}

function listRecentSessions(days) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return readAll()
    .filter((s) => new Date(s.startTime) >= since)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

function getTodaySessionCount() {
  const todayKey = dateKey(new Date());
  return readAll().filter((s) => s.type === 'work' && dateKey(new Date(s.startTime)) === todayKey).length;
}

function listSessionsForTaskInRange(taskId, startIso, endIso) {
  if (!taskId) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  return readAll().filter(
    (s) => s.taskId === taskId && s.type === 'work' && new Date(s.startTime) >= start && new Date(s.startTime) < end
  );
}

function summarizeStats(days) {
  const sessions = listRecentSessions(days);
  const workSessions = sessions.filter((s) => s.type === 'work');

  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const count = workSessions.filter((s) => dateKey(new Date(s.startTime)) === key).length;
    daily.push({ date: key, count });
  }

  const weekly = {
    count: workSessions.length,
    totalSeconds: workSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
  };

  return { daily, weekly };
}

module.exports = {
  recordSession,
  listRecentSessions,
  listSessionsForTaskInRange,
  getTodaySessionCount,
  summarizeStats,
};
