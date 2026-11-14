const START_HOUR = 6;
const END_HOUR = 23; // last row start; row spans to END_HOUR+1
const ROW_H = 48;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function hourToDate(dateKey, hour) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function dateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}/${m}/${d} (${WEEKDAYS[dt.getDay()]})`;
}

function formatHour(h) {
  return `${h}:00`;
}

function dateKeyOfIso(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatClock(iso) {
  const d = new Date(iso);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

const dateParam = new URLSearchParams(location.search).get('date');
let currentDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam || '') ? dateParam : todayKey();
let dragStartHour = null;
let dragHoverHour = null;
let isDragging = false;
let pendingRange = null; // {startHour, endHour}

const rowsEl = document.getElementById('timeline-rows');
const blocksEl = document.getElementById('timeline-blocks');
const dateLabelEl = document.getElementById('date-label');
const createFormWrap = document.getElementById('create-form-wrap');
const rangeLabelEl = document.getElementById('range-label');
const taskSelectEl = document.getElementById('task-select');
const plannedInputEl = document.getElementById('planned-input');
const dayHabitsEl = document.getElementById('day-habits');
const dayHabitsListEl = document.getElementById('day-habits-list');
const dayHabitsCountEl = document.getElementById('day-habits-count');
const dayTasksListEl = document.getElementById('day-tasks-list');
const dayTasksCountEl = document.getElementById('day-tasks-count');

function renderRows() {
  const rows = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    rows.push(`
      <div class="timeline-row" data-hour="${h}">
        <div class="timeline-hour">${formatHour(h)}</div>
        <div class="timeline-slot"></div>
      </div>
    `);
  }
  rowsEl.innerHTML = rows.join('');

  rowsEl.querySelectorAll('.timeline-row').forEach((row) => {
    const hour = Number(row.dataset.hour);
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      dragStartHour = hour;
      dragHoverHour = hour;
      highlightRange(hour, hour);
    });
    row.addEventListener('mouseenter', () => {
      if (!isDragging) return;
      dragHoverHour = hour;
      highlightRange(dragStartHour, hour);
    });
  });
}

function highlightRange(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  rowsEl.querySelectorAll('.timeline-row').forEach((row) => {
    const h = Number(row.dataset.hour);
    row.classList.toggle('selecting', h >= lo && h <= hi);
  });
}

function clearHighlight() {
  rowsEl.querySelectorAll('.timeline-row').forEach((row) => row.classList.remove('selecting'));
}

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  const lo = Math.min(dragStartHour, dragHoverHour);
  const hi = Math.max(dragStartHour, dragHoverHour);
  openCreateForm(lo, hi + 1);
  dragStartHour = null;
  dragHoverHour = null;
});

async function openCreateForm(startHour, endHour) {
  pendingRange = { startHour, endHour };
  rangeLabelEl.textContent = `${formatHour(startHour)} 〜 ${formatHour(endHour)}`;
  plannedInputEl.value = Math.max(1, endHour - startHour);
  createFormWrap.classList.remove('hidden');

  const tasks = await apiGet('/api/tasks?status=todo');
  // 表示中の日が期限のタスク（週間ビューで日付に入れたものなど）を先頭に出す
  const dueOnDay = (t) => (t.dueDate && dateKeyOfIso(t.dueDate) === currentDate ? 1 : 0);
  tasks.sort((a, b) => dueOnDay(b) - dueOnDay(a));
  taskSelectEl.innerHTML =
    '<option value="">選択してください</option>' +
    tasks.map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');

  taskSelectEl.focus();
}

function closeCreateForm() {
  pendingRange = null;
  createFormWrap.classList.add('hidden');
  clearHighlight();
}

document.getElementById('cancel-create').addEventListener('click', closeCreateForm);
createFormWrap.addEventListener('click', (e) => {
  if (e.target === createFormWrap) closeCreateForm();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !createFormWrap.classList.contains('hidden')) closeCreateForm();
});

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingRange) return;
  const taskId = taskSelectEl.value;
  if (!taskId) return;

  await apiSend('POST', '/api/timeboxes', {
    taskId,
    startTime: hourToDate(currentDate, pendingRange.startHour).toISOString(),
    endTime: hourToDate(currentDate, pendingRange.endHour).toISOString(),
    plannedPomodoros: Number(plannedInputEl.value) || 1,
  });

  closeCreateForm();
  loadBoxes();
});

async function deleteBox(id) {
  if (!(await confirmDialog('この時間枠を削除しますか？'))) return;
  await apiDelete(`/api/timeboxes/${id}`);
  loadBoxes();
}

async function carryOverBox(id) {
  await apiSend('POST', `/api/timeboxes/${id}/carry-over`, {});
  loadBoxes();
}

function renderBlocks(boxes, tasksById) {
  const now = new Date();
  blocksEl.innerHTML = boxes
    .map((b) => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const startHour = start.getHours() + start.getMinutes() / 60;
      const endHour = end.getHours() + end.getMinutes() / 60;
      const top = (startHour - START_HOUR) * ROW_H;
      const height = Math.max(24, (endHour - startHour) * ROW_H - 4);
      const task = tasksById[b.taskId];
      const title = task ? task.title : '（削除されたタスク）';
      const isPastUnfinished = end < now && b.consumedPomodoros < b.plannedPomodoros;

      return `
        <div class="timeline-block" data-id="${b.id}" style="top:${top}px;height:${height}px;background:var(--color-accent-100);color:var(--color-accent-800);">
          <div class="timeline-block-title">${escapeHtml(title)}</div>
          <div class="timeline-block-meta">
            <span>${b.consumedPomodoros}/${b.plannedPomodoros} 🍅</span>
            ${isPastUnfinished ? `<button type="button" class="carry-over" data-id="${b.id}" title="翌日へ繰越">繰越</button>` : ''}
            <button type="button" class="delete-box" data-id="${b.id}" title="削除">✕</button>
          </div>
        </div>
      `;
    })
    .join('');

  blocksEl.querySelectorAll('.delete-box').forEach((btn) => {
    btn.addEventListener('click', () => deleteBox(btn.dataset.id));
  });
  blocksEl.querySelectorAll('.carry-over').forEach((btn) => {
    btn.addEventListener('click', () => carryOverBox(btn.dataset.id));
  });
}

function renderDayTasks(tasks, boxes) {
  const dayTasks = tasks
    .filter((t) => t.dueDate && dateKeyOfIso(t.dueDate) === currentDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  dayTasksCountEl.textContent = `${dayTasks.length}件`;

  if (dayTasks.length === 0) {
    dayTasksListEl.innerHTML = '<div class="day-tasks-empty">この日が期限のタスクはありません。</div>';
    return;
  }

  dayTasksListEl.innerHTML = dayTasks
    .map((t) => {
      const chips = boxes
        .filter((b) => b.taskId === t.id)
        .map((b) => `<span class="tag tag-accent">${formatClock(b.startTime)}–${formatClock(b.endTime)}</span>`);
      if (t.estimateMinutes) chips.push(`<span class="tag tag-neutral">約${t.estimateMinutes}分</span>`);
      chips.push(
        `<span class="tag ${PRIORITY_TAG_CLASS[t.priority] || 'tag-neutral'}">${PRIORITY_LABEL[t.priority] || t.priority}</span>`
      );
      return `
        <div class="day-task ${t.status === 'done' ? 'done' : ''}">
          <input type="checkbox" data-id="${t.id}" data-status="${t.status}" ${t.status === 'done' ? 'checked' : ''} aria-label="完了" />
          <span class="day-task-time">期限 ${formatClock(t.dueDate)}</span>
          <a class="day-task-title" href="task.html?id=${t.id}">${escapeHtml(t.title)}</a>
          <div class="day-task-chips">${chips.join('')}</div>
        </div>`;
    })
    .join('');
}

dayTasksListEl.addEventListener('change', async (e) => {
  const box = e.target.closest('input[type="checkbox"][data-id]');
  if (!box) return;
  await apiSend('PUT', `/api/tasks/${box.dataset.id}`, { status: box.dataset.status === 'done' ? 'todo' : 'done' });
  loadBoxes();
});

// --- 習慣（タスクとは別データ。色と破線の枠で区別する） ---

function toHours(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

async function setHabitDone(habitId, done) {
  await apiSend('PUT', `/api/habits/${habitId}/logs/${currentDate}`, { done });
  loadBoxes();
}

function renderDayHabits(habits) {
  const list = habits.filter((h) => h.scheduled);
  dayHabitsEl.classList.toggle('hidden', list.length === 0);
  dayHabitsCountEl.textContent = `${list.filter((h) => h.done).length} / ${list.length}`;
  const isFuture = currentDate > todayKey();

  dayHabitsListEl.innerHTML = list
    .map((h) => {
      const chips = [];
      const time = habitTimeLabel(h);
      if (time) chips.push(`<span class="tag tag-accent-2">${time}</span>`);
      chips.push(`<span class="tag tag-neutral">${escapeHtml(habitRepeatLabel(h))}</span>`);
      if (h.repeat.type === 'weekly') chips.push(`<span class="tag tag-neutral">今週 ${h.week.done} / ${h.week.target}</span>`);
      const streak = habitStreakLabel(h);
      if (streak) chips.push(`<span class="tag tag-neutral">${streak}</span>`);
      return `
        <div class="day-task day-habit ${h.done ? 'done' : ''}">
          <input type="checkbox" data-habit="${h.id}" ${h.done ? 'checked' : ''} ${isFuture ? 'disabled' : ''} aria-label="達成を記録" />
          <span class="day-task-title">${escapeHtml(h.title)}</span>
          <div class="day-task-chips">${chips.join('')}</div>
        </div>`;
    })
    .join('');
}

dayHabitsListEl.addEventListener('change', (e) => {
  const box = e.target.closest('input[type="checkbox"][data-habit]');
  if (box) setHabitDone(box.dataset.habit, box.checked);
});

function renderHabitBlocks(habits) {
  const isFuture = currentDate > todayKey();
  const html = habits
    .filter((h) => h.scheduled && h.startTime && h.endTime)
    .map((h) => {
      const from = Math.max(toHours(h.startTime), START_HOUR);
      const to = Math.min(toHours(h.endTime), END_HOUR + 1);
      if (to <= from) return '';
      const top = (from - START_HOUR) * ROW_H;
      const height = Math.max(24, (to - from) * ROW_H - 4);
      return `
        <div class="timeline-block habit-block ${h.done ? 'done' : ''} ${height < 40 ? 'compact' : ''}" style="top:${top}px;height:${height}px;">
          <div class="timeline-block-title">${escapeHtml(h.title)}</div>
          <div class="timeline-block-meta">
            <span>習慣</span>
            <button type="button" class="habit-toggle" data-id="${h.id}" data-done="${h.done}" ${isFuture ? 'disabled' : ''}>${h.done ? '✓ 済' : '完了にする'}</button>
          </div>
        </div>`;
    })
    .join('');

  blocksEl.classList.toggle('has-habits', html !== '');
  blocksEl.insertAdjacentHTML('beforeend', html);
  blocksEl.querySelectorAll('.habit-toggle').forEach((btn) => {
    btn.addEventListener('click', () => setHabitDone(btn.dataset.id, btn.dataset.done !== 'true'));
  });
}

async function loadBoxes() {
  dateLabelEl.textContent = dateLabel(currentDate);
  const [boxes, tasks, habits] = await Promise.all([
    apiGet(`/api/timeboxes?date=${currentDate}`),
    apiGet('/api/tasks'),
    apiGet(`/api/habits?date=${currentDate}`),
  ]);
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  renderBlocks(boxes, tasksById);
  renderHabitBlocks(habits);
  renderDayTasks(tasks, boxes);
  renderDayHabits(habits);
}

document.getElementById('prev-day').addEventListener('click', () => {
  currentDate = shiftDateKey(currentDate, -1);
  closeCreateForm();
  loadBoxes();
});
document.getElementById('next-day').addEventListener('click', () => {
  currentDate = shiftDateKey(currentDate, 1);
  closeCreateForm();
  loadBoxes();
});
document.getElementById('today-btn').addEventListener('click', () => {
  currentDate = todayKey();
  closeCreateForm();
  loadBoxes();
});

renderRows();
loadBoxes();
