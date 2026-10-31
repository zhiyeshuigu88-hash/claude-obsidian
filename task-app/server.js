const express = require('express');
const path = require('path');
const taskStore = require('./lib/taskStore');
const pomodoroStore = require('./lib/pomodoroStore');
const timeboxStore = require('./lib/timeboxStore');
const habitStore = require('./lib/habitStore');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function pad(n) {
  return String(n).padStart(2, '0');
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- Tasks ---

app.get('/api/tasks', (req, res) => {
  const { status, tag, sortBy } = req.query;
  res.json(taskStore.listTasks({ status, tag, sortBy }));
});

app.get('/api/tasks/due-today', (req, res) => {
  res.json(taskStore.listTasksDueToday());
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskStore.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

app.get('/api/tasks/:id/subtasks', (req, res) => {
  res.json(taskStore.listSubtasks(req.params.id));
});

app.post('/api/tasks', (req, res) => {
  const { title, description, dueDate, priority, tags, parentTaskId, estimateMinutes } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const task = taskStore.createTask({ title, description, dueDate, priority, tags, parentTaskId, estimateMinutes });
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const task = taskStore.updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  taskStore.deleteTask(req.params.id);
  res.json({ ok: true });
});

// --- Pomodoro ---

app.get('/api/pomodoro/today-count', (req, res) => {
  res.json({ count: pomodoroStore.getTodaySessionCount() });
});

app.get('/api/pomodoro/stats', (req, res) => {
  const days = Number(req.query.days) || 7;
  res.json(pomodoroStore.summarizeStats(days));
});

app.post('/api/pomodoro/sessions', (req, res) => {
  const { taskId, startTime, endTime, duration, type } = req.body;
  const session = pomodoroStore.recordSession({ taskId, startTime, endTime, duration, type });
  res.status(201).json(session);
});

// --- Timeboxes (timeline / F-40〜F-43) ---

app.get('/api/timeboxes', (req, res) => {
  const { from, to } = req.query;
  const boxes = from && to
    ? timeboxStore.listForRange(from, to)
    : timeboxStore.listForDate(req.query.date || localToday());
  const enriched = boxes.map((b) => ({
    ...b,
    consumedPomodoros: pomodoroStore.listSessionsForTaskInRange(b.taskId, b.startTime, b.endTime).length,
  }));
  res.json(enriched);
});

app.post('/api/timeboxes', (req, res) => {
  const { taskId, startTime, endTime, plannedPomodoros } = req.body;
  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'startTime and endTime are required' });
  }
  const box = timeboxStore.createTimebox({ taskId, startTime, endTime, plannedPomodoros });
  res.status(201).json(box);
});

app.delete('/api/timeboxes/:id', (req, res) => {
  timeboxStore.deleteTimebox(req.params.id);
  res.json({ ok: true });
});

app.post('/api/timeboxes/:id/carry-over', (req, res) => {
  const box = timeboxStore.carryOverToNextDay(req.params.id);
  if (!box) return res.status(404).json({ error: 'not found' });
  res.status(201).json(box);
});

// --- Habits (習慣: タスクとは別データ。やらなかった日は翌日に持ち越さない) ---

app.get('/api/habits', (req, res) => {
  const date = habitStore.isValidDate(req.query.date) ? req.query.date : habitStore.todayKey();
  res.json(habitStore.listWithStatus(date));
});

app.get('/api/habits/logs', (req, res) => {
  const { from, to } = req.query;
  if (!habitStore.isValidDate(from) || !habitStore.isValidDate(to)) {
    return res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
  }
  res.json(habitStore.listLogs(from, to));
});

app.post('/api/habits', (req, res) => {
  const result = habitStore.createHabit(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result.value);
});

app.put('/api/habits/:id', (req, res) => {
  const result = habitStore.updateHabit(req.params.id, req.body);
  if (result.notFound) return res.status(404).json({ error: 'not found' });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result.value);
});

app.delete('/api/habits/:id', (req, res) => {
  habitStore.deleteHabit(req.params.id);
  res.json({ ok: true });
});

app.put('/api/habits/:id/logs/:date', (req, res) => {
  const { id, date } = req.params;
  if (!habitStore.getHabit(id)) return res.status(404).json({ error: 'not found' });
  if (!habitStore.isValidDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  if (date > habitStore.todayKey()) return res.status(400).json({ error: '未来の日付は記録できません' });
  habitStore.setLog(id, date, Boolean(req.body && req.body.done));
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Focus Task 起動中: http://localhost:${PORT}`));
} else {
  module.exports = app;
}
