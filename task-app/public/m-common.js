// スマホ用の画面（/m/）で共通の部品: 下のタブバー。
// body の data-tab（home / tasks / schedule / habits / more）で現在地を決める。

const M_ICON = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const M_TABS = [
  { key: 'home', href: 'index.html', label: 'ホーム', icon: M_ICON('<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>') },
  { key: 'tasks', href: 'tasks.html', label: 'タスク', icon: M_ICON('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><polyline points="3.5 6 4.8 7.3 6.8 4.8"/><polyline points="3.5 12 4.8 13.3 6.8 10.8"/><polyline points="3.5 18 4.8 19.3 6.8 16.8"/>') },
  { key: 'schedule', href: 'schedule.html', label: '予定', icon: M_ICON('<rect x="3" y="4" width="18" height="17" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/>') },
  { key: 'habits', href: 'habits.html', label: '習慣', icon: M_ICON('<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/>') },
  { key: 'more', href: 'more.html', label: 'その他', icon: M_ICON('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>') },
];

function renderTabbar() {
  const nav = document.getElementById('m-tabbar');
  if (!nav) return;
  const current = document.body.dataset.tab;
  nav.innerHTML = M_TABS.map(
    (t) => `<a class="m-tab ${t.key === current ? 'active' : ''}" href="${t.href}"${t.key === current ? ' aria-current="page"' : ''}>${t.icon}<span>${t.label}</span></a>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', renderTabbar);

// 日付ヘルパー（スマホ用の各ページで使う）
function mPad(n) {
  return String(n).padStart(2, '0');
}

function mDateKey(d) {
  return `${d.getFullYear()}-${mPad(d.getMonth() + 1)}-${mPad(d.getDate())}`;
}

function mParseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mShiftKey(key, days) {
  const d = mParseKey(key);
  d.setDate(d.getDate() + days);
  return mDateKey(d);
}

const M_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 期限が 23:59（時刻の指定なし）なら時刻は出さない
function mDueLabel(iso) {
  const d = new Date(iso);
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  const allDay = d.getHours() === 23 && d.getMinutes() === 59;
  return allDay ? date : `${date} ${d.getHours()}:${mPad(d.getMinutes())}`;
}

// タスク行・習慣行の共通マークアップ
function mTaskRow(t) {
  const done = t.status === 'done';
  const chips = [];
  if (t.dueDate) {
    const overdue = !done && new Date(t.dueDate) < new Date();
    chips.push(`<span class="tag ${overdue ? 'tag-warn' : 'tag-neutral'}">${overdue ? '期限切れ ' : ''}${mDueLabel(t.dueDate)}</span>`);
  }
  chips.push(`<span class="tag ${PRIORITY_TAG_CLASS[t.priority] || 'tag-neutral'}">${PRIORITY_LABEL[t.priority] || t.priority}</span>`);
  (t.tags || []).forEach((tag) => chips.push(`<span class="tag tag-neutral">#${escapeHtml(tag)}</span>`));
  if (t.estimateMinutes) chips.push(`<span class="tag tag-neutral">${t.estimateMinutes}分</span>`);
  return `
    <div class="m-row ${done ? 'done' : ''}">
      <button type="button" class="m-check" data-task="${t.id}" data-status="${t.status}" aria-pressed="${done}" aria-label="完了にする">✓</button>
      <div class="m-row-body">
        <a class="m-row-title" href="task.html?id=${t.id}">${escapeHtml(t.title)}</a>
        <div class="m-row-chips">${chips.join('')}</div>
      </div>
    </div>`;
}

function mHabitRow(h, { disabled = false } = {}) {
  const chips = [];
  const time = habitTimeLabel(h);
  if (time) chips.push(`<span class="tag tag-accent-2">${time}</span>`);
  chips.push(`<span class="tag tag-neutral">${escapeHtml(habitRepeatLabel(h))}</span>`);
  if (h.repeat.type === 'weekly') chips.push(`<span class="tag tag-neutral">今週 ${h.week.done} / ${h.week.target}</span>`);
  const streak = habitStreakLabel(h);
  if (streak) chips.push(`<span class="tag tag-neutral">${streak}</span>`);
  return `
    <div class="m-row ${h.done ? 'done' : ''}">
      <button type="button" class="m-check habit" data-habit="${h.id}" data-done="${h.done}" aria-pressed="${h.done}" aria-label="達成を記録" ${disabled ? 'disabled' : ''}>✓</button>
      <div class="m-row-body">
        <span class="m-row-title">${escapeHtml(h.title)}</span>
        <div class="m-row-chips">${chips.join('')}</div>
      </div>
    </div>`;
}

async function mToggleTask(btn) {
  await apiSend('PUT', `/api/tasks/${btn.dataset.task}`, { status: btn.dataset.status === 'done' ? 'todo' : 'done' });
}

async function mToggleHabit(btn, dateKey) {
  await apiSend('PUT', `/api/habits/${btn.dataset.habit}/logs/${dateKey}`, { done: btn.dataset.done !== 'true' });
}
