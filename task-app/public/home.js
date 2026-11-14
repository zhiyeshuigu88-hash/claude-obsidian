const params = new URLSearchParams(location.search);
const state = {
  status: params.get('status') || 'todo',
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

// ヒーローの「今日の進み具合」用
const heroState = { tasks: 0, tasksDone: 0, habits: 0, habitsDone: 0 };

function updateHero() {
  const el = document.getElementById('hero-sub');
  if (!el) return;
  const { tasks, tasksDone, habits, habitsDone } = heroState;
  el.textContent =
    tasks + habits === 0
      ? '今日の予定はまだありません。'
      : `今日のタスク ${tasksDone} / ${tasks} 完了 ・ 習慣 ${habitsDone} / ${habits} 達成`;
}

function priorityPill(priority) {
  return `<span class="pri pri-${priority}">${PRIORITY_LABEL[priority] || priority}</span>`;
}

function renderDueToday(tasks) {
  const top = tasks.filter((t) => !t.parentTaskId);
  heroState.tasks = top.length;
  heroState.tasksDone = top.filter((t) => t.status === 'done').length;
  updateHero();

  const html =
    top.length === 0
      ? '<p class="sub tt-empty">今日が期限のタスクはありません。</p>'
      : top
          .map(
            (t) => `
    <div class="tt-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
      <label class="tt-task">
        <input type="checkbox" class="toggle" data-id="${t.id}" data-status="${t.status}" ${t.status === 'done' ? 'checked' : ''} />
        <a href="task.html?id=${t.id}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</a>
      </label>
      ${priorityPill(t.priority)}
      <span class="tt-status">${t.status === 'done' ? '完了' : '未完了'}</span>
      <span class="tt-est">${t.estimateMinutes ? t.estimateMinutes + '分' : '–'}</span>
    </div>`
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
        ${priorityPill(t.priority)}
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
  heroState.habits = todays.length;
  heroState.habitsDone = todays.filter((h) => h.done).length;
  updateHero();

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

// タイマーが完了したら、今日のポモドーロ数などを更新する（timer.js から呼ばれる）
function onPomodoroComplete() {
  loadAll();
  loadAnalytics();
  loadTimerStats();
  loadSchedule();
}

// --- 時間の内訳（直近7日） ---

const AN_PARTS = [
  { key: 'task', label: 'タスク', cls: 'an-task' },
  { key: 'habit', label: '習慣', cls: 'an-habit' },
  { key: 'free', label: '紐付けなし', cls: 'an-free' },
  { key: 'break', label: '休憩', cls: 'an-break' },
];

function formatHm(seconds) {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function loadAnalytics() {
  const { totalSeconds, parts } = await apiGet('/api/pomodoro/breakdown?days=7');
  document.getElementById('an-total').textContent = formatHm(totalSeconds);
  const bars = document.getElementById('an-bars');
  if (totalSeconds === 0) {
    bars.innerHTML = '<p class="sub an-empty">まだ記録がありません。タイマーを使うと、ここに内訳が出ます。</p>';
    return;
  }
  bars.innerHTML = AN_PARTS.filter((p) => parts[p.key] > 0)
    .map((p) => {
      const pct = Math.round((parts[p.key] / totalSeconds) * 100);
      // 割合が小さくても文字が収まる幅を確保する
      const grow = Math.max(parts[p.key], totalSeconds * 0.12);
      return `<div class="an-seg" style="flex:${grow} 1 0"><span class="an-label">${p.label}</span><div class="an-bar ${p.cls}">${pct}%</div></div>`;
    })
    .join('');
}

// --- 今日のスケジュール（横向きのタイムライン） ---

const HS_START = 6;
const HS_END = 24;
const HS_HOUR_W = 88;
const HS_LANE_H = 54;
let scheduleScrolled = false;

function clockToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function loadSchedule() {
  const today = habitTodayKey();
  const [boxes, tasks, habits] = await Promise.all([
    apiGet(`/api/timeboxes?date=${today}`),
    apiGet('/api/tasks'),
    apiGet(`/api/habits?date=${today}`),
  ]);
  const titleOf = Object.fromEntries(tasks.map((t) => [t.id, t.title]));

  const items = [];
  for (const b of boxes) {
    const s = new Date(b.startTime);
    const e = new Date(b.endTime);
    const start = s.getHours() * 60 + s.getMinutes();
    let end = e.getHours() * 60 + e.getMinutes();
    if (end <= start) end = 24 * 60; // 翌日 0:00 は 24:00 扱い
    items.push({ kind: 'box', start, end, title: titleOf[b.taskId] || '（削除されたタスク）', meta: `ポモドーロ ${b.consumedPomodoros || 0} / ${b.plannedPomodoros}` });
  }
  for (const h of habits) {
    if (h.scheduled && h.startTime && h.endTime) {
      items.push({ kind: 'habit', start: clockToMinutes(h.startTime), end: clockToMinutes(h.endTime), title: h.title, meta: h.done ? '習慣 ・ 達成' : '習慣', done: h.done });
    }
  }
  items.sort((a, b) => a.start - b.start);

  // 重なる予定は段を分ける
  const laneEnds = [];
  for (const it of items) {
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = it.end;
    it.lane = lane;
  }

  const lanes = Math.max(1, laneEnds.length);
  const width = (HS_END - HS_START) * HS_HOUR_W;
  const x = (minutes) => Math.min(Math.max((minutes / 60 - HS_START) * HS_HOUR_W, 0), width);

  const hours = Array.from({ length: HS_END - HS_START }, (_, i) => `<span class="hs-hour" style="left:${i * HS_HOUR_W + 8}px">${HS_START + i}:00</span>`).join('');
  const blocks = items
    .filter((it) => it.end > HS_START * 60)
    .map((it) => {
      const left = x(it.start);
      const w = Math.max(x(it.end) - left - 6, 60);
      return `<div class="hs-item ${it.kind} ${it.done ? 'done' : ''}" style="left:${left}px;width:${w}px;top:${40 + it.lane * HS_LANE_H}px" title="${escapeHtml(it.title)}">
        <span class="hs-title">${escapeHtml(it.title)}</span><small>${Math.floor(it.start / 60)}:${String(it.start % 60).padStart(2, '0')}–${Math.floor(it.end / 60)}:${String(it.end % 60).padStart(2, '0')} ・ ${it.meta}</small>
      </div>`;
    })
    .join('');

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLeft = x(nowMin);
  const nowLine = nowMin >= HS_START * 60 ? `<div class="hs-now" style="left:${nowLeft}px"></div>` : '';

  const hs = document.getElementById('hs');
  hs.style.width = width + 'px';
  hs.style.minHeight = 40 + lanes * HS_LANE_H + 8 + 'px';
  hs.style.setProperty('--hour-w', HS_HOUR_W + 'px');
  hs.innerHTML =
    '<div class="hs-grid"></div>' +
    hours +
    blocks +
    nowLine +
    (items.length === 0 ? '<p class="hs-empty">今日の時間枠はありません。<a href="timeline.html">日間ビューで追加</a>できます。</p>' : '');

  if (!scheduleScrolled) {
    scheduleScrolled = true;
    document.getElementById('hs-scroll').scrollLeft = Math.max(0, nowLeft - 140);
  }
}

// タイマーカードの下: 今日と直近7日のポモドーロ回数
async function loadTimerStats() {
  const [today, stats] = await Promise.all([apiGet('/api/pomodoro/today-count'), apiGet('/api/pomodoro/stats?days=7')]);
  document.getElementById('ts-today').textContent = today.count;
  document.getElementById('ts-week').textContent = stats.weekly.count;
}

loadAnalytics();
loadTimerStats();
loadSchedule();
setInterval(loadSchedule, 60000); // 現在時刻の線を進める

// 上のバーの「＋ タスク追加」から、またはほかのページから ?new=1 で開かれたときにモーダルを開く
window.onNewTask = openCreateModal;
if (params.get('new')) {
  history.replaceState(null, '', location.pathname);
  openCreateModal();
}
