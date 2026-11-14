// スマホ版 予定: 週間と日間をひとつにまとめた画面。
// 上の1週間バーで日を選び、その日の時間枠・タスク・習慣を縦に並べる。

const START_HOUR = 6;
const END_HOUR = 24;

const schedToday = mDateKey(new Date());
const schedParam = new URLSearchParams(location.search).get('date');
let selected = /^\d{4}-\d{2}-\d{2}$/.test(schedParam || '') ? schedParam : schedToday;
let data = null;

const stripEl = document.getElementById('m-strip');
const boxListEl = document.getElementById('m-box-list');
const taskListEl = document.getElementById('m-task-list');
const habitListEl = document.getElementById('m-habit-list');
const habitSectionEl = document.getElementById('m-habit-section');
const unsetListEl = document.getElementById('m-unset-list');

// 週は月曜始まり
function mondayOf(key) {
  const d = mParseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return mDateKey(d);
}

function dayHour(date, hour) {
  const [y, m, d] = [date.getFullYear(), date.getMonth(), date.getDate()];
  return new Date(y, m, d, hour, 0, 0, 0);
}

function clock(iso, startIso) {
  const d = new Date(iso);
  // 翌日 0:00 は「24:00」と表示する
  if (startIso && d.getHours() === 0 && d.getMinutes() === 0 && mDateKey(d) !== mDateKey(new Date(startIso))) return '24:00';
  return `${d.getHours()}:${mPad(d.getMinutes())}`;
}

async function load() {
  const ws = mondayOf(selected);
  const we = mShiftKey(ws, 6);
  const [tasks, boxes, habits] = await Promise.all([
    apiGet('/api/tasks'),
    apiGet(`/api/timeboxes?from=${ws}&to=${we}`),
    apiGet(`/api/habits?date=${selected}`),
  ]);
  data = { ws, we, tasks, boxes, habits };
  render();
}

function tasksDueOn(day) {
  return data.tasks.filter((t) => t.dueDate && mDateKey(new Date(t.dueDate)) === day);
}

function boxesOn(day) {
  return data.boxes.filter((b) => mDateKey(new Date(b.startTime)) === day);
}

function render() {
  const { ws, we, tasks, habits } = data;

  // 週の見出しと1週間バー
  const w0 = mParseKey(ws);
  const w1 = mParseKey(we);
  document.getElementById('m-week-label').textContent = `${w0.getMonth() + 1}/${w0.getDate()} – ${w1.getMonth() + 1}/${w1.getDate()}`;
  stripEl.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const key = mShiftKey(ws, i);
    const d = mParseKey(key);
    const count = tasksDueOn(key).filter((t) => t.status !== 'done').length + boxesOn(key).length;
    return `
      <button type="button" class="m-day ${key === selected ? 'selected' : ''} ${key === schedToday ? 'today' : ''}" data-day="${key}" aria-pressed="${key === selected}">
        <small>${M_WEEKDAYS[d.getDay()]}</small>
        <b>${d.getDate()}</b>
        <span class="m-dots">${'<i class="m-dot"></i>'.repeat(Math.min(count, 3))}</span>
      </button>`;
  }).join('');

  // その日
  const sel = mParseKey(selected);
  document.getElementById('m-day-title').textContent =
    `${sel.getMonth() + 1}月${sel.getDate()}日（${M_WEEKDAYS[sel.getDay()]}）`;

  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const boxes = boxesOn(selected);
  boxListEl.innerHTML =
    boxes.length === 0
      ? '<p class="m-empty">時間枠はありません。</p>'
      : boxes
          .map((b) => {
            const task = byId[b.taskId];
            const nowMs = Date.now();
            const active = selected === schedToday && new Date(b.startTime).getTime() <= nowMs && nowMs < new Date(b.endTime).getTime();
            return `
      <div class="m-row m-box ${active ? 'now' : ''}">
        <div class="m-row-body">
          <div class="m-box-top">
            <span class="m-row-title">${task ? escapeHtml(task.title) : '（削除されたタスク）'}</span>
            <span class="m-box-time">${clock(b.startTime)}–${clock(b.endTime, b.startTime)}</span>
            <button type="button" class="m-x" data-box-del="${b.id}" aria-label="時間枠を削除">×</button>
          </div>
          <div class="m-box-foot"><span>ポモドーロ${active ? '（いま）' : ''}</span><b>${b.consumedPomodoros || 0} / ${b.plannedPomodoros}</b></div>
        </div>
      </div>`;
          })
          .join('');

  const due = tasksDueOn(selected);
  taskListEl.innerHTML = due.length === 0 ? '<p class="m-empty">この日が期限のタスクはありません。</p>' : due.map(mTaskRow).join('');

  const todays = habits.filter((h) => h.scheduled);
  habitSectionEl.classList.toggle('hidden', todays.length === 0);
  habitListEl.innerHTML = todays.map((h) => mHabitRow(h, { disabled: selected > schedToday })).join('');

  renderSummary();

  const unset = tasks.filter((t) => !t.dueDate && t.status === 'todo');
  document.getElementById('m-unset-title').textContent = `日付が未設定のタスク（${unset.length}）`;
  document.getElementById('m-unset').classList.toggle('hidden', unset.length === 0);
  unsetListEl.innerHTML = unset
    .map(
      (t) => `
    <div class="m-row">
      <div class="m-row-body"><a class="m-row-title" href="task.html?id=${t.id}">${escapeHtml(t.title)}</a></div>
      <button type="button" class="btn btn-secondary" data-assign="${t.id}">この日に入れる</button>
    </div>`
    )
    .join('');
}

function renderSummary() {
  const { ws, we, tasks, boxes, habits } = data;
  const weekTasks = tasks.filter((t) => t.dueDate && mDateKey(new Date(t.dueDate)) >= ws && mDateKey(new Date(t.dueDate)) <= we);
  const done = weekTasks.filter((t) => t.status === 'done').length;

  const target = habits.reduce((s, h) => s + h.week.target, 0);
  const achieved = habits.reduce((s, h) => s + Math.min(h.week.done, h.week.target), 0);
  const habitRate = target ? `${Math.round((achieved / target) * 100)}%` : '–';

  const hours = boxes.reduce((s, b) => s + (new Date(b.endTime) - new Date(b.startTime)) / 3600000, 0);

  document.getElementById('m-summary').innerHTML = `
    <div class="m-stat"><span>タスク完了</span><b>${done} / ${weekTasks.length}</b></div>
    <div class="m-stat"><span>習慣達成率</span><b>${habitRate}</b></div>
    <div class="m-stat"><span>予定時間</span><b>${Math.round(hours * 10) / 10}h</b></div>`;
}

// --- 日の選択・週の移動 ---

function select(day) {
  selected = day;
  history.replaceState(null, '', `?date=${day}`);
  load();
}

stripEl.addEventListener('click', (e) => {
  const day = e.target.closest('[data-day]');
  if (day) select(day.dataset.day);
});
document.getElementById('m-prev').addEventListener('click', () => select(mShiftKey(selected, -7)));
document.getElementById('m-next').addEventListener('click', () => select(mShiftKey(selected, 7)));
document.getElementById('m-today').addEventListener('click', () => select(schedToday));

// --- チェック（タスク・習慣） ---

document.addEventListener('click', async (e) => {
  const check = e.target.closest('.m-check');
  if (!check) return;
  if (check.dataset.task) await mToggleTask(check);
  else if (check.dataset.habit) await mToggleHabit(check, selected);
  load();
});

// --- 時間枠の削除 ---

boxListEl.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-box-del]');
  if (!del) return;
  if (await confirmDialog('この時間枠を削除しますか？')) {
    await apiDelete(`/api/timeboxes/${del.dataset.boxDel}`);
    load();
  }
});

// --- 未設定のタスクをこの日に入れる（期限の時刻があれば維持、なければ 23:59） ---

unsetListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-assign]');
  if (!btn) return;
  const [y, m, d] = selected.split('-').map(Number);
  await apiSend('PUT', `/api/tasks/${btn.dataset.assign}`, { dueDate: new Date(y, m - 1, d, 23, 59).toISOString() });
  load();
});

// --- 時間枠の追加 ---

function addBoxDialog() {
  const todo = data.tasks.filter((t) => t.status === 'todo');
  // この日が期限のタスクを先に並べる
  const dueFirst = [...todo].sort((a, b) => Number(mDateKey(new Date(b.dueDate || 0)) === selected) - Number(mDateKey(new Date(a.dueDate || 0)) === selected));
  const startDefault = selected === schedToday ? Math.min(Math.max(new Date().getHours() + 1, START_HOUR), END_HOUR - 1) : 9;
  const hourOptions = (from, to, current) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((h) => `<option value="${h}" ${h === current ? 'selected' : ''}>${h}:00</option>`)
      .join('');

  if (todo.length === 0) {
    return showDialog(
      `<div class="dialog"><div class="dialog-title">時間枠を追加</div><p class="dialog-body">未完了のタスクがありません。先にタスクを追加してください。</p>
       <div class="dialog-actions"><button type="button" class="btn btn-primary" data-cancel>閉じる</button></div></div>`,
      (backdrop, close) => backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(false))
    );
  }

  return showDialog(
    `<form class="dialog">
       <div class="dialog-title">時間枠を追加</div>
       <div class="field"><label>タスク</label>
         <select name="taskId">${dueFirst.map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('')}</select>
       </div>
       <div class="field"><label>時間帯</label>
         <div class="m-hours">
           <select name="start">${hourOptions(START_HOUR, END_HOUR - 1, startDefault)}</select>
           <span>〜</span>
           <select name="end">${hourOptions(START_HOUR + 1, END_HOUR, startDefault + 1)}</select>
         </div>
       </div>
       <div class="habit-form-error" data-error></div>
       <div class="dialog-actions">
         <button type="button" class="btn btn-ghost" data-cancel>キャンセル</button>
         <button type="submit" class="btn btn-primary">追加</button>
       </div>
     </form>`,
    (backdrop, close) => {
      const form = backdrop.querySelector('form');
      const errorEl = backdrop.querySelector('[data-error]');
      backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(false));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = Number(form.elements.start.value);
        const end = Number(form.elements.end.value);
        if (end <= start) {
          errorEl.textContent = '終了は開始より後にしてください';
          return;
        }
        const day = mParseKey(selected);
        await apiSend('POST', '/api/timeboxes', {
          taskId: form.elements.taskId.value,
          startTime: dayHour(day, start).toISOString(),
          endTime: dayHour(day, end).toISOString(),
          plannedPomodoros: Math.max(1, Math.round(((end - start) * 60) / 25)),
        });
        close(true);
      });
    }
  );
}

document.getElementById('m-add-box').addEventListener('click', async () => {
  if (await addBoxDialog()) load();
});

load();
