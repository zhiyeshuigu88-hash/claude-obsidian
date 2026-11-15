// スマホ版 Home: 大きなタイマー（timer.js）と「今日やること」だけ。タスク一覧は「タスク」タブへ。

const homeToday = mDateKey(new Date());
const todayListEl = document.getElementById('m-today-list');
const todayCountEl = document.getElementById('m-today-count');

(function showDate() {
  const d = new Date();
  document.getElementById('m-date').textContent = `${d.getMonth() + 1}月${d.getDate()}日（${M_WEEKDAYS[d.getDay()]}）`;
})();

async function loadToday() {
  const [due, habits] = await Promise.all([apiGet('/api/tasks/due-today'), apiGet(`/api/habits?date=${homeToday}`)]);
  const tasks = due.filter((t) => !t.parentTaskId);
  const todays = habits.filter((h) => h.scheduled);

  const total = tasks.length + todays.length;
  const done = tasks.filter((t) => t.status === 'done').length + todays.filter((h) => h.done).length;
  todayCountEl.textContent = `${done} / ${total}`;

  todayListEl.innerHTML =
    total === 0
      ? '<p class="m-empty">今日やることはありません。</p>'
      : tasks.map(mTaskRow).join('') + todays.map((h) => mHabitRow(h)).join('');
}

todayListEl.addEventListener('click', async (e) => {
  const check = e.target.closest('.m-check');
  if (!check) return;
  if (check.dataset.task) await mToggleTask(check);
  else if (check.dataset.habit) await mToggleHabit(check, homeToday);
  loadToday();
});

// Round 表示: 今日完了したポモドーロを 4 つ 1 組で数える
async function loadRound() {
  const { count } = await apiGet('/api/pomodoro/today-count');
  const filled = count % 4;
  document.getElementById('m-round-label').textContent = `Round ${Math.floor(count / 4) + 1}`;
  document.getElementById('m-round-dots').innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i < filled ? 'on' : ''}">✓</i>`).join('');
}

// タイマー（timer.js）が作業を終えたときに呼ばれる
function onPomodoroComplete() {
  loadToday();
  loadRound();
}

loadToday();
loadRound();
