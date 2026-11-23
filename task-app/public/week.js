const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKeyOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftKey(key, days) {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dateKeyOf(d);
}

// 週は月曜始まり
function mondayOf(key) {
  const d = parseKey(key);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return dateKeyOf(d);
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

let weekStart = mondayOf(dateKeyOf(new Date()));

const gridEl = document.getElementById('week-grid');
const labelEl = document.getElementById('week-label');

function renderWeek(days, tasks, boxes) {
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const todayKey = dateKeyOf(new Date());

  gridEl.innerHTML = days
    .map((key) => {
      const d = parseKey(key);
      const dueTasks = tasks
        .filter((t) => t.dueDate && dateKeyOf(new Date(t.dueDate)) === key)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      const dayBoxes = boxes.filter((b) => dateKeyOf(new Date(b.startTime)) === key);

      const taskHtml = dueTasks
        .map(
          (t) => `
          <a class="week-item week-task ${t.status === 'done' ? 'done' : ''}" href="task.html?id=${t.id}">
            <span class="week-item-time">${formatTime(t.dueDate)}</span>
            <span class="week-item-title">${escapeHtml(t.title)}</span>
            ${t.estimateMinutes ? `<span class="week-item-meta">約${t.estimateMinutes}分</span>` : ''}
          </a>`
        )
        .join('');

      const boxHtml = dayBoxes
        .map((b) => {
          const task = tasksById[b.taskId];
          const title = task ? task.title : '（削除されたタスク）';
          return `
          <a class="week-item week-box" href="timeline.html?date=${key}">
            <span class="week-item-time">${formatTime(b.startTime)}–${formatTime(b.endTime)}</span>
            <span class="week-item-title">${escapeHtml(title)}</span>
            <span class="week-item-meta">${b.consumedPomodoros}/${b.plannedPomodoros} 🍅</span>
          </a>`;
        })
        .join('');

      const empty = !taskHtml && !boxHtml ? '<div class="week-empty">予定なし</div>' : '';

      return `
        <section class="week-day ${key === todayKey ? 'today' : ''}" data-day="${key}">
          <a class="week-day-head" href="timeline.html?date=${key}">
            <span class="week-day-name">${WEEKDAYS[d.getDay()]}</span>
            <span class="week-day-date">${d.getMonth() + 1}/${d.getDate()}</span>
          </a>
          ${taskHtml ? `<div class="week-section-label">期限</div>${taskHtml}` : ''}
          ${boxHtml ? `<div class="week-section-label">時間枠</div>${boxHtml}` : ''}
          ${empty}
        </section>`;
    })
    .join('');
}

// --- 未割り当てタスク / 今週のサマリー ---

let currentDays = [];
let currentTasks = [];
let draggingTaskId = null;

const unassignedEl = document.getElementById('unassigned-list');
const unassignedCountEl = document.getElementById('unassigned-count');

function minutesBetween(startIso, endIso) {
  return Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60000));
}

function formatLoad(min) {
  if (min <= 0) return '0';
  if (min < 60) return `${min}m`;
  return `${Math.round(min / 6) / 10}h`;
}

function computeWeek(days, tasks, boxes) {
  const boxesByTask = {};
  boxes.forEach((b) => {
    if (b.taskId) (boxesByTask[b.taskId] = boxesByTask[b.taskId] || []).push(b);
  });

  const dayLoad = Object.fromEntries(days.map((k) => [k, 0]));
  const weekTaskIds = new Set();

  tasks.forEach((t) => {
    const taskBoxes = boxesByTask[t.id] || [];
    const dueKey = t.dueDate ? dateKeyOf(new Date(t.dueDate)) : null;
    const dueInWeek = dueKey !== null && days.includes(dueKey);
    if (taskBoxes.length || dueInWeek) weekTaskIds.add(t.id);

    // 時間枠があればその長さ、なければ期限日に見積もり時間を計上する
    if (taskBoxes.length) {
      taskBoxes.forEach((b) => {
        const k = dateKeyOf(new Date(b.startTime));
        if (k in dayLoad) dayLoad[k] += minutesBetween(b.startTime, b.endTime);
      });
    } else if (dueInWeek && t.estimateMinutes) {
      dayLoad[dueKey] += t.estimateMinutes;
    }
  });

  const weekTasks = tasks.filter((t) => weekTaskIds.has(t.id));
  const unassigned = tasks
    .filter((t) => t.status !== 'done' && !weekTaskIds.has(t.id))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  return {
    dayLoad,
    unassigned,
    total: weekTasks.length,
    done: weekTasks.filter((t) => t.status === 'done').length,
    totalMinutes: Object.values(dayLoad).reduce((s, m) => s + m, 0),
  };
}

function renderUnassigned(list) {
  unassignedCountEl.textContent = `${list.length}件`;
  if (list.length === 0) {
    unassignedEl.innerHTML = '<div class="unassigned-empty">未割り当てのタスクはありません。</div>';
    return;
  }
  unassignedEl.innerHTML = list
    .map((t) => {
      const chips = [];
      if (t.estimateMinutes) chips.push(`<span class="tag tag-neutral">約${t.estimateMinutes}分</span>`);
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        chips.push(`<span class="tag tag-accent">${d.getMonth() + 1}/${d.getDate()}まで</span>`);
      } else {
        chips.push('<span class="tag tag-neutral">期限なし</span>');
      }
      return `
        <div class="unassigned-card" draggable="true" data-id="${t.id}">
          <span class="unassigned-handle" aria-hidden="true">⠿</span>
          <div class="unassigned-body">
            <a class="unassigned-title" href="task.html?id=${t.id}" draggable="false">${escapeHtml(t.title)}</a>
            <div class="unassigned-chips">${chips.join('')}</div>
          </div>
          <button type="button" class="btn btn-ghost" data-act="pick" data-id="${t.id}">日付に入れる</button>
        </div>`;
    })
    .join('');
}

function renderSummary(days, info) {
  const { done, total, dayLoad, totalMinutes } = info;
  document.getElementById('sum-done').innerHTML = `${done} <small>/ ${total}件</small>`;
  document.getElementById('sum-hours').innerHTML = `${Math.round(totalMinutes / 6) / 10} <small>時間</small>`;

  const rate = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('sum-rate').textContent = `${rate}%`;
  document.getElementById('sum-rate-bar').style.width = `${rate}%`;

  const max = Math.max(0, ...days.map((k) => dayLoad[k]));
  const busiestKey = max > 0 ? days.find((k) => dayLoad[k] === max) : null;
  const busiestEl = document.getElementById('sum-busiest');
  if (busiestKey) {
    const d = parseKey(busiestKey);
    busiestEl.innerHTML = `いちばん忙しい日：<b>${WEEKDAYS[d.getDay()]}曜 ${d.getMonth() + 1}/${d.getDate()}</b>`;
  } else {
    busiestEl.textContent = '';
  }

  const todayKey = dateKeyOf(new Date());
  document.getElementById('sum-load').innerHTML = days
    .map((k) => {
      const m = dayLoad[k];
      const h = max > 0 && m > 0 ? Math.max(6, Math.round((m / max) * 84)) : 4;
      return `
        <div class="summary-load-col ${k === todayKey ? 'today' : ''}">
          <span class="summary-load-val">${formatLoad(m)}</span>
          <div class="summary-load-bar" style="height:${h}px"></div>
          <span class="summary-load-day">${WEEKDAYS[parseKey(k).getDay()]}</span>
        </div>`;
    })
    .join('');
}

function renderLower(days, tasks, boxes) {
  const info = computeWeek(days, tasks, boxes);
  renderUnassigned(info.unassigned);
  renderSummary(days, info);
}

// --- 日付への割り当て（ドラッグ or ボタン） ---

async function assignTask(taskId, dayKey) {
  const task = currentTasks.find((t) => t.id === taskId);
  if (!task) return;
  // 既に期限の時刻があれば維持し、なければその日の終わり（23:59）にする
  const base = task.dueDate ? new Date(task.dueDate) : null;
  const [y, m, d] = dayKey.split('-').map(Number);
  const due = new Date(y, m - 1, d, base ? base.getHours() : 23, base ? base.getMinutes() : 59);
  await apiSend('PUT', `/api/tasks/${taskId}`, { dueDate: due.toISOString() });
  await load();
}

function pickDayDialog(task) {
  const todayKey = dateKeyOf(new Date());
  const buttons = currentDays
    .map((key) => {
      const d = parseKey(key);
      return `<button type="button" class="btn btn-secondary day-pick ${key === todayKey ? 'today' : ''}" data-day="${key}">${WEEKDAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}</button>`;
    })
    .join('');
  return showDialog(
    `<div class="dialog" role="dialog" aria-modal="true">
       <div class="dialog-title">日付に入れる</div>
       <div class="dialog-body">${escapeHtml(task.title)}</div>
       <div class="day-pick-list">${buttons}</div>
       <div class="dialog-actions"><button type="button" class="btn btn-ghost" data-cancel>キャンセル</button></div>
     </div>`,
    (backdrop, close) => {
      backdrop.querySelectorAll('.day-pick').forEach((b) => b.addEventListener('click', () => close(b.dataset.day)));
      backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    }
  );
}

function createTaskDialog() {
  let priority = 'medium';
  return showDialog(
    `<form class="dialog" style="width:min(460px,100%);max-height:90vh;overflow:auto;">
       <div class="dialog-title">新規タスク作成</div>
       <div class="field"><label>タイトル</label><input name="title" placeholder="タイトル" required /></div>
       <div class="field"><label>詳細</label><textarea name="description" placeholder="詳細" rows="2"></textarea></div>
       <div class="field"><label>期限</label><input name="dueDate" type="datetime-local" /></div>
       <div class="field">
         <label>優先度</label>
         <div class="seg">
           <a href="#" class="seg-opt" data-value="high">高</a>
           <a href="#" class="seg-opt active" data-value="medium">中</a>
           <a href="#" class="seg-opt" data-value="low">低</a>
         </div>
       </div>
       <div class="field"><label>タグ（カンマ区切り）</label><input name="tags" placeholder="タグ（カンマ区切り）" /></div>
       <div class="field"><label>見積もり時間（分・任意）</label><input name="estimateMinutes" type="number" min="1" placeholder="例: 30" /></div>
       <div class="dialog-actions">
         <button type="button" class="btn btn-ghost" data-cancel>キャンセル</button>
         <button type="submit" class="btn btn-primary">作成</button>
       </div>
     </form>`,
    (backdrop, close) => {
      const form = backdrop.querySelector('form');
      form.querySelector('[name="title"]').focus();
      form.querySelectorAll('.seg-opt').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.preventDefault();
          priority = opt.dataset.value;
          form.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('active', o === opt));
        });
      });
      backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        await apiSend('POST', '/api/tasks', {
          title: data.get('title'),
          description: data.get('description'),
          dueDate: data.get('dueDate') ? new Date(String(data.get('dueDate'))).toISOString() : null,
          priority,
          tags: String(data.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
          estimateMinutes: data.get('estimateMinutes') ? Number(data.get('estimateMinutes')) : null,
        });
        close(true);
      });
    }
  );
}

document.getElementById('add-task-btn').addEventListener('click', async () => {
  if (await createTaskDialog()) load();
});

unassignedEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act="pick"]');
  if (!btn) return;
  const task = currentTasks.find((t) => t.id === btn.dataset.id);
  if (!task) return;
  const dayKey = await pickDayDialog(task);
  if (dayKey) assignTask(task.id, dayKey);
});

unassignedEl.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.unassigned-card');
  if (!card) return;
  draggingTaskId = card.dataset.id;
  e.dataTransfer.setData('text/plain', draggingTaskId);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});

unassignedEl.addEventListener('dragend', () => {
  draggingTaskId = null;
  document.querySelectorAll('.unassigned-card.dragging').forEach((c) => c.classList.remove('dragging'));
  clearDropTargets();
});

function clearDropTargets() {
  gridEl.querySelectorAll('.week-day.drop-target').forEach((el) => el.classList.remove('drop-target'));
}

gridEl.addEventListener('dragover', (e) => {
  if (!draggingTaskId) return;
  const day = e.target.closest('.week-day[data-day]');
  if (!day) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (!day.classList.contains('drop-target')) {
    clearDropTargets();
    day.classList.add('drop-target');
  }
});

gridEl.addEventListener('dragleave', (e) => {
  if (!gridEl.contains(e.relatedTarget)) clearDropTargets();
});

gridEl.addEventListener('drop', (e) => {
  const day = e.target.closest('.week-day[data-day]');
  if (!day || !draggingTaskId) return;
  e.preventDefault();
  const taskId = draggingTaskId;
  draggingTaskId = null;
  clearDropTargets();
  assignTask(taskId, day.dataset.day);
});

// --- 習慣（7日×習慣の達成チェック。未割り当てタスクやタスク完了数には含めない） ---

const habitWrapEl = document.getElementById('habit-grid-wrap');

function isHabitScheduledOn(habit, key) {
  return habit.repeat.type !== 'days' || habit.repeat.days.includes(parseKey(key).getDay());
}

function renderHabits(days, habits, logs) {
  const active = habits.filter((h) => h.week.active);

  // サマリー: タスク完了率とは別に「習慣達成率」を出す
  const target = active.reduce((s, h) => s + h.week.target, 0);
  const done = active.reduce((s, h) => s + Math.min(h.week.done, h.week.target), 0);
  const summaryEl = document.getElementById('habit-summary');
  summaryEl.classList.toggle('hidden', target === 0);
  if (target > 0) {
    const rate = Math.round((done / target) * 100);
    document.getElementById('habit-rate').textContent = `${rate}%`;
    document.getElementById('habit-rate-bar').style.width = `${rate}%`;
    document.getElementById('habit-note').textContent = `達成 ${done} / ${target} 回`;
  }

  if (active.length === 0) {
    habitWrapEl.innerHTML =
      '<div class="habit-panel-empty">この週に対象の習慣はありません。「習慣を管理」から追加できます。</div>';
    return;
  }

  const doneSet = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
  const todayKey = dateKeyOf(new Date());

  const head = days
    .map((k) => {
      const d = parseKey(k);
      return `<div class="habit-grid-head ${k === todayKey ? 'today' : ''}">${WEEKDAYS[d.getDay()]}<br>${d.getMonth() + 1}/${d.getDate()}</div>`;
    })
    .join('');

  const rows = active
    .map((h) => {
      const cells = days
        .map((k) => {
          const isDone = doneSet.has(`${h.id}|${k}`);
          const scheduled = isHabitScheduledOn(h, k);
          const future = k > todayKey;
          const cls = ['habit-cell'];
          if (isDone) cls.push('done');
          if (!scheduled) cls.push('off');
          if (future) cls.push('future');
          if (k === todayKey) cls.push('today');
          const disabled = future || (!scheduled && !isDone);
          return `<button type="button" class="${cls.join(' ')}" data-habit="${h.id}" data-day="${k}" data-done="${isDone}" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(h.title)} ${k}">${isDone ? '✓' : ''}</button>`;
        })
        .join('');
      const sub = [habitRepeatLabel(h), habitTimeLabel(h), habitStreakLabel(h)].filter(Boolean).join(' ・ ');
      const met = h.week.target > 0 && h.week.done >= h.week.target;
      return `
        <div class="habit-name">${escapeHtml(h.title)}<small>${escapeHtml(sub)}</small></div>
        ${cells}
        <div class="habit-count ${met ? 'met' : ''}">${h.week.done}/${h.week.target}</div>`;
    })
    .join('');

  habitWrapEl.innerHTML = `<div class="habit-grid"><div></div>${head}<div></div>${rows}</div>`;
}

habitWrapEl.addEventListener('click', async (e) => {
  const cell = e.target.closest('.habit-cell');
  if (!cell || cell.disabled) return;
  await apiSend('PUT', `/api/habits/${cell.dataset.habit}/logs/${cell.dataset.day}`, {
    done: cell.dataset.done !== 'true',
  });
  load();
});

async function load() {
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(weekStart, i));
  const from = days[0];
  const to = days[6];
  const a = parseKey(from);
  const b = parseKey(to);
  labelEl.textContent = `${a.getFullYear()}/${a.getMonth() + 1}/${a.getDate()} 〜 ${b.getMonth() + 1}/${b.getDate()}`;

  const [tasks, boxes, habits, habitLogs] = await Promise.all([
    apiGet('/api/tasks'),
    apiGet(`/api/timeboxes?from=${from}&to=${to}`),
    apiGet(`/api/habits?date=${from}`),
    apiGet(`/api/habits/logs?from=${from}&to=${to}`),
  ]);
  currentDays = days;
  currentTasks = tasks;
  renderWeek(days, tasks, boxes);
  renderLower(days, tasks, boxes);
  renderHabits(days, habits, habitLogs);
}

document.getElementById('prev-week').addEventListener('click', () => {
  weekStart = shiftKey(weekStart, -7);
  load();
});
document.getElementById('next-week').addEventListener('click', () => {
  weekStart = shiftKey(weekStart, 7);
  load();
});
document.getElementById('this-week-btn').addEventListener('click', () => {
  weekStart = mondayOf(dateKeyOf(new Date()));
  load();
});

load();
