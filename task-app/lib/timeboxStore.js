const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'timeboxes.json');

function ensureFile() {
  if (fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(boxes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(boxes, null, 2), 'utf-8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function listForDate(dateStr) {
  return readAll()
    .filter((b) => dateKey(new Date(b.startTime)) === dateStr)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function listForRange(fromStr, toStr) {
  return readAll()
    .filter((b) => {
      const key = dateKey(new Date(b.startTime));
      return key >= fromStr && key <= toStr;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function createTimebox({ taskId, startTime, endTime, plannedPomodoros }) {
  const boxes = readAll();
  const box = {
    id: crypto.randomUUID(),
    taskId: taskId || null,
    startTime,
    endTime,
    plannedPomodoros: Math.max(1, Number(plannedPomodoros) || 1),
    createdAt: new Date().toISOString(),
  };
  boxes.push(box);
  writeAll(boxes);
  return box;
}

function deleteTimebox(id) {
  writeAll(readAll().filter((b) => b.id !== id));
}

function carryOverToNextDay(id) {
  const boxes = readAll();
  const box = boxes.find((b) => b.id === id);
  if (!box) return null;

  const start = new Date(box.startTime);
  const end = new Date(box.endTime);
  start.setDate(start.getDate() + 1);
  end.setDate(end.getDate() + 1);

  const next = {
    id: crypto.randomUUID(),
    taskId: box.taskId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    plannedPomodoros: box.plannedPomodoros,
    createdAt: new Date().toISOString(),
  };

  writeAll(boxes.filter((b) => b.id !== id).concat([next]));
  return next;
}

module.exports = {
  listForDate,
  listForRange,
  createTimebox,
  deleteTimebox,
  carryOverToNextDay,
};
