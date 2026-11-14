const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function ensureFile() {
  if (fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

function isToday(dueDate) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function listTasks({ status, tag, sortBy } = {}) {
  let tasks = readAll().filter((t) => !t.parentTaskId);

  if (status) tasks = tasks.filter((t) => t.status === status);
  if (tag) tasks = tasks.filter((t) => (t.tags || []).includes(tag));

  const sorted = tasks.slice();
  if (sortBy === 'priority') {
    sorted.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
  } else {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }
  return sorted;
}

function listTasksDueToday() {
  return readAll()
    .filter((t) => isToday(t.dueDate))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function listSubtasks(parentId) {
  return readAll()
    .filter((t) => t.parentTaskId === parentId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getTask(id) {
  return readAll().find((t) => t.id === id) || null;
}

function normalizeEstimate(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function createTask({ title, description, dueDate, priority, tags, parentTaskId, estimateMinutes }) {
  const tasks = readAll();
  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    title: String(title || '').trim(),
    description: description || '',
    dueDate: dueDate || null,
    priority: priority || 'medium',
    tags: Array.isArray(tags) ? tags : [],
    status: 'todo',
    parentTaskId: parentTaskId || null,
    estimateMinutes: normalizeEstimate(estimateMinutes),
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  writeAll(tasks);
  return task;
}

function updateTask(id, fields) {
  if (fields && 'estimateMinutes' in fields) fields = { ...fields, estimateMinutes: normalizeEstimate(fields.estimateMinutes) };
  const tasks = readAll();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...fields, updatedAt: new Date().toISOString() };
  writeAll(tasks);
  return tasks[idx];
}

function deleteTask(id) {
  const tasks = readAll();
  const toDelete = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.parentTaskId && toDelete.has(t.parentTaskId) && !toDelete.has(t.id)) {
        toDelete.add(t.id);
        changed = true;
      }
    }
  }
  writeAll(tasks.filter((t) => !toDelete.has(t.id)));
}

module.exports = {
  listTasks,
  listTasksDueToday,
  listSubtasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
