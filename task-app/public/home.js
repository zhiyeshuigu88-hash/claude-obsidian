function scoped(root, name) {
  return Array.from(root.querySelectorAll(`[data-el="${name}"]`));
}

const params = new URLSearchParams(location.search);
const state = {
  status: params.get('status') || 'all',
  sortBy: params.get('sortBy') || 'dueDate',
  tag: params.get('tag') || '',
};
let newPriority = 'medium';

function qs(overrides) {
  const p = new URLSearchParams({ status: state.status, sortBy: state.sortBy, tag: state.tag });
  Object.entries(overrides).forEach(([k, v]) => p.set(k, v));
  return `?${p.toString()}`;
}

function renderFilters() {
  const html = `
    <div class="seg">
      <a class="seg-opt ${state.status === 'all' ? 'active' : ''}" href="${qs({ status: 'all' })}">すべて</a>
      <a class="seg-opt ${state.status === 'todo' ? 'active' : ''}" href="${qs({ status: 'todo' })}">未完了</a>
      <a class="seg-opt ${state.status === 'done' ? 'active' : ''}" href="${qs({ status: 'done' })}">完了</a>
    </div>
    <div class="seg">
      <a class="seg-opt ${state.sortBy === 'dueDate' ? 'active' : ''}" href="${qs({ sortBy: 'dueDate' })}">期限順</a>
      <a class="seg-opt ${state.sortBy === 'priority' ? 'active' : ''}" href="${qs({ sortBy: 'priority' })}">優先度順</a>
    </div>
  `;
  scoped(document, 'filters').forEach((el) => (el.innerHTML = html));
}

async function toggleTaskStatus(id, currentStatus) {
  await apiSend('PUT', `/api/tasks/${id}`, { status: currentStatus === 'done' ? 'todo' : 'done' });
  loadAll();
}

async function deleteTask(id) {
  await apiDelete(`/api/tasks/${id}`);
  loadAll();
}

function bindToggleAndDelete(container) {
  container.querySelectorAll('.toggle').forEach((el) => {
    el.addEventListener('change', () => toggleTaskStatus(el.dataset.id, el.dataset.status));
  });
  container.querySelectorAll('.delete').forEach((el) => {
    el.addEventListener('click', async () => {
      if (await confirmDialog('このタスクを削除しますか？')) deleteTask(el.dataset.id);
    });
  });
}

function renderDueToday(tasks) {
  const html =
    tasks.length === 0
      ? '<p class="text-muted" style="font-size:13px;">本日期限のタスクはありません。</p>'
      : tasks
          .map(
            (t) => `
    <div class="card" data-id="${t.id}">
      <div class="task-item">
        <input type="checkbox" class="toggle" data-id="${t.id}" data-status="${t.status}" ${t.status === 'done' ? 'checked' : ''} />
        <a class="title ${t.status === 'done' ? 'done' : ''}" href="task.html?id=${t.id}">${escapeHtml(t.title)}</a>
        <span class="tag ${PRIORITY_TAG_CLASS[t.priority] || 'tag-neutral'}">${PRIORITY_LABEL[t.priority] || t.priority}</span>
      </div>
    </div>
  `
          )
          .join('');

  scoped(document, 'due-today-list').forEach((el) => {
    el.innerHTML = html;
    bindToggleAndDelete(el);
  });
}

function taskCardHtml(t) {
  return `
    <div class="card" data-id="${t.id}">
      <div class="task-item">
        <input type="checkbox" class="toggle" data-id="${t.id}" data-status="${t.status}" ${t.status === 'done' ? 'checked' : ''} />
        <a class="title ${t.status === 'done' ? 'done' : ''}" href="task.html?id=${t.id}">${escapeHtml(t.title)}</a>
        <span class="tag ${PRIORITY_TAG_CLASS[t.priority] || 'tag-neutral'}">${PRIORITY_LABEL[t.priority] || t.priority}</span>
      </div>
      ${t.dueDate ? `<div class="card-meta">期限: ${formatDateTime(t.dueDate)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">
        ${(t.tags || []).map((tag) => `<span class="tag tag-neutral">#${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <a href="task.html?id=${t.id}" class="btn btn-ghost">編集</a>
        <button class="btn btn-icon btn-secondary delete" data-id="${t.id}" type="button" style="margin-left:auto;color:var(--color-accent-700);" title="削除">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        </button>
      </div>
    </div>
  `;
}

function renderTasks(tasks) {
  const html =
    tasks.length === 0
      ? '<p class="text-muted" style="font-size:13px;">タスクがありません。</p>'
      : tasks.map(taskCardHtml).join('');

  scoped(document, 'task-list').forEach((el) => {
    el.innerHTML = html;
    bindToggleAndDelete(el);
  });
}

async function loadAll() {
  const query = new URLSearchParams();
  if (state.status !== 'all') query.set('status', state.status);
  if (state.tag) query.set('tag', state.tag);
  query.set('sortBy', state.sortBy);

  const [dueToday, todayCount, tasks] = await Promise.all([
    apiGet('/api/tasks/due-today'),
    apiGet('/api/pomodoro/today-count'),
    apiGet(`/api/tasks?${query.toString()}`),
  ]);

  const sidebarCountEl = document.getElementById('sidebar-today-count');
  if (sidebarCountEl) sidebarCountEl.textContent = todayCount.count;
  renderDueToday(dueToday);
  renderTasks(tasks);
}

// --- Create-task modal + priority segmented control ---

const createModal = scoped(document, 'create-form-wrap')[0];

function openCreateModal() {
  createModal.classList.remove('hidden');
  createModal.querySelector('[name="title"]').focus();
}

function closeCreateModal() {
  createModal.classList.add('hidden');
}

scoped(document, 'add-toggle-btn').forEach((btn) => btn.addEventListener('click', openCreateModal));
scoped(document, 'create-cancel').forEach((btn) => btn.addEventListener('click', closeCreateModal));
createModal.addEventListener('click', (e) => {
  if (e.target === createModal) closeCreateModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !createModal.classList.contains('hidden')) closeCreateModal();
});

scoped(document, 'new-priority-seg').forEach((seg) => {
  seg.querySelectorAll('.seg-opt').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.preventDefault();
      newPriority = opt.dataset.value;
      scoped(document, 'new-priority-seg').forEach((s) => {
        s.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('active', o.dataset.value === newPriority));
      });
    });
  });
});

scoped(document, 'create-form').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    await apiSend('POST', '/api/tasks', {
      title: data.get('title'),
      description: data.get('description'),
      dueDate: fromLocalInputValue(data.get('dueDate')),
      priority: newPriority,
      estimateMinutes: data.get('estimateMinutes') ? Number(data.get('estimateMinutes')) : null,
      tags: String(data.get('tags') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    scoped(document, 'create-form').forEach((f) => f.reset());
    newPriority = 'medium';
    scoped(document, 'new-priority-seg').forEach((s) => {
      s.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('active', o.dataset.value === 'medium'));
    });
    closeCreateModal();
    loadAll();
  });
});

renderFilters();
loadAll();

// --- 今日の習慣（タスクとは別データ。チェックは今日の分だけ） ---

function habitTodayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const habitListEl = scoped(document, 'habit-list')[0];
const habitCountEl = scoped(document, 'habit-count')[0];

function renderHabits(habits) {
  const todays = habits.filter((h) => h.scheduled);
  habitCountEl.textContent = `${todays.filter((h) => h.done).length} / ${todays.length}`;

  if (habits.length === 0) {
    habitListEl.innerHTML =
      '<p class="text-muted" style="font-size:13px;">習慣はまだありません。<a href="habits.html">習慣ページ</a>から追加できます。</p>';
    return;
  }
  if (todays.length === 0) {
    habitListEl.innerHTML = '<p class="text-muted" style="font-size:13px;">今日の習慣はありません。</p>';
    return;
  }

  habitListEl.innerHTML = todays
    .map((h) => {
      const chips = [];
      const time = habitTimeLabel(h);
      if (time) chips.push(`<span class="tag tag-accent-2">${time}</span>`);
      chips.push(`<span class="tag tag-neutral">${escapeHtml(habitRepeatLabel(h))}</span>`);
      if (h.repeat.type === 'weekly') chips.push(`<span class="tag tag-neutral">今週 ${h.week.done} / ${h.week.target}</span>`);
      const streak = habitStreakLabel(h);
      if (streak) chips.push(`<span class="tag tag-neutral">${streak}</span>`);
      return `
        <div class="habit-card ${h.done ? 'done' : ''}">
          <button type="button" class="habit-check" data-habit="${h.id}" data-done="${h.done}" aria-pressed="${h.done}" aria-label="今日の達成を記録">✓</button>
          <div class="habit-body">
            <div class="habit-title">${escapeHtml(h.title)}</div>
            <div class="habit-chips">${chips.join('')}</div>
          </div>
        </div>`;
    })
    .join('');
}

async function loadHabits() {
  renderHabits(await apiGet(`/api/habits?date=${habitTodayKey()}`));
}

habitListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.habit-check');
  if (!btn) return;
  await apiSend('PUT', `/api/habits/${btn.dataset.habit}/logs/${habitTodayKey()}`, { done: btn.dataset.done !== 'true' });
  loadHabits();
});

loadHabits();

// --- Pomodoro timer ---

const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

function loadMinutes(key, fallback) {
  const stored = window.localStorage.getItem(key);
  const n = Number(stored);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const workMinutes = loadMinutes('taskapp.workMinutes', DEFAULT_WORK_MINUTES);
const breakMinutes = loadMinutes('taskapp.breakMinutes', DEFAULT_BREAK_MINUTES);

let timerMode = 'work';
let secondsLeft = workMinutes * 60;
let timerIntervalId = null;
let timerStartedAt = null;
let selectedTaskId = '';

function durationForMode(m) {
  return (m === 'work' ? workMinutes : breakMinutes) * 60;
}

function renderTimer() {
  scoped(document, 'time-display').forEach((el) => (el.textContent = formatTime(secondsLeft)));
  scoped(document, 'mode-label').forEach((el) => (el.textContent = timerMode === 'work' ? '作業中' : '休憩中'));
  scoped(document, 'start-btn').forEach((el) => (el.style.display = timerIntervalId ? 'none' : ''));
  scoped(document, 'pause-btn').forEach((el) => (el.style.display = timerIntervalId ? '' : 'none'));
  scoped(document, 'task-select').forEach((el) => (el.disabled = Boolean(timerIntervalId)));
}

async function handleTimerComplete() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;

  const endTime = new Date();
  const startTime = timerStartedAt || endTime;
  const duration = Math.round((endTime - startTime) / 1000);

  try {
    await apiSend('POST', '/api/pomodoro/sessions', {
      taskId: timerMode === 'work' && selectedTaskId ? selectedTaskId : null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      type: timerMode,
    });
  } catch (e) {
    console.error(e);
  }

  timerMode = timerMode === 'work' ? 'break' : 'work';
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
  loadAll();
}

function tick() {
  secondsLeft -= 1;
  if (secondsLeft <= 0) {
    secondsLeft = 0;
    renderTimer();
    handleTimerComplete();
    return;
  }
  renderTimer();
}

function handleTimerStart() {
  if (!timerIntervalId) {
    timerStartedAt = new Date(Date.now() - (durationForMode(timerMode) - secondsLeft) * 1000);
    timerIntervalId = setInterval(tick, 1000);
  }
  renderTimer();
}

function handleTimerPause() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  renderTimer();
}

function handleTimerSkip() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  timerMode = timerMode === 'work' ? 'break' : 'work';
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
}

function handleTimerReset() {
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  secondsLeft = durationForMode(timerMode);
  timerStartedAt = null;
  renderTimer();
}

scoped(document, 'start-btn').forEach((el) => el.addEventListener('click', handleTimerStart));
scoped(document, 'pause-btn').forEach((el) => el.addEventListener('click', handleTimerPause));
scoped(document, 'skip-btn').forEach((el) => el.addEventListener('click', handleTimerSkip));
scoped(document, 'reset-btn').forEach((el) => el.addEventListener('click', handleTimerReset));
scoped(document, 'task-select').forEach((el) => {
  el.addEventListener('change', () => {
    selectedTaskId = el.value;
  });
});

async function loadTimerTaskOptions() {
  const tasks = await apiGet('/api/tasks?status=todo');
  const optionsHtml =
    '<option value="">（選択なし）</option>' +
    tasks.map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
  scoped(document, 'task-select').forEach((el) => {
    el.innerHTML = optionsHtml;
    el.value = selectedTaskId;
  });
}

loadTimerTaskOptions();
renderTimer();
