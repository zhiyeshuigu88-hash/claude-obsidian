function pad(n) {
  return String(n).padStart(2, '0');
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const listEl = document.getElementById('habit-list');
const overviewEl = document.getElementById('habit-overview');
let habits = [];

const TRASH_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

function renderOverview() {
  if (habits.length === 0) {
    overviewEl.classList.add('hidden');
    return;
  }
  const todays = habits.filter((h) => h.scheduled);
  const doneToday = todays.filter((h) => h.done).length;
  const target = habits.reduce((s, h) => s + h.week.target, 0);
  const done = habits.reduce((s, h) => s + Math.min(h.week.done, h.week.target), 0);
  const rate = target ? Math.round((done / target) * 100) : 0;

  overviewEl.classList.remove('hidden');
  overviewEl.innerHTML = `
    <div class="habit-overview-tiles">
      <div class="summary-stat"><div class="summary-stat-label">今日の達成</div><div class="summary-stat-value">${doneToday} <small>/ ${todays.length}件</small></div></div>
      <div class="summary-stat"><div class="summary-stat-label">今週の習慣達成率</div><div class="summary-stat-value">${rate}<small>%</small></div></div>
    </div>
    <div class="summary-progress"><div class="summary-progress-fill habit" style="width:${rate}%"></div></div>
  `;
}

function renderList() {
  if (habits.length === 0) {
    listEl.innerHTML =
      '<div class="habit-empty">まだ習慣がありません。「＋ 習慣を追加」から、毎日続けたいことを登録しましょう。</div>';
    return;
  }

  listEl.innerHTML = habits
    .map((h) => {
      const chips = [`<span class="tag tag-accent-2">${escapeHtml(habitRepeatLabel(h))}</span>`];
      const time = habitTimeLabel(h);
      if (time) chips.push(`<span class="tag tag-neutral">${time}</span>`);
      const streak = habitStreakLabel(h);
      if (streak) chips.push(`<span class="tag tag-neutral">${streak}</span>`);
      chips.push(`<span class="tag tag-neutral">今週 ${h.week.done} / ${h.week.target}</span>`);
      if (!h.scheduled) chips.push('<span class="tag tag-neutral">今日はお休み</span>');

      return `
        <div class="habit-card ${h.done ? 'done' : ''}">
          <button type="button" class="habit-check" data-act="toggle" data-id="${h.id}" aria-pressed="${h.done}" aria-label="今日の達成を記録" ${h.scheduled ? '' : 'disabled'}>✓</button>
          <div class="habit-body">
            <div class="habit-title">${escapeHtml(h.title)}</div>
            <div class="habit-chips">${chips.join('')}</div>
          </div>
          <div class="habit-actions">
            <button type="button" class="btn btn-ghost" data-act="edit" data-id="${h.id}">編集</button>
            <button type="button" class="btn btn-icon btn-secondary" data-act="delete" data-id="${h.id}" title="削除" style="color:var(--color-accent-700);">${TRASH_ICON}</button>
          </div>
        </div>`;
    })
    .join('');
}

async function load() {
  habits = await apiGet(`/api/habits?date=${todayKey()}`);
  renderOverview();
  renderList();
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const habit = habits.find((h) => h.id === btn.dataset.id);
  if (!habit) return;

  if (btn.dataset.act === 'toggle') {
    await apiSend('PUT', `/api/habits/${habit.id}/logs/${todayKey()}`, { done: !habit.done });
    load();
  } else if (btn.dataset.act === 'edit') {
    if (await habitDialog(habit)) load();
  } else if (btn.dataset.act === 'delete') {
    if (await confirmDialog(`「${habit.title}」と実施記録を削除しますか？`)) {
      await apiDelete(`/api/habits/${habit.id}`);
      load();
    }
  }
});

document.getElementById('add-habit-btn').addEventListener('click', async () => {
  if (await habitDialog(null)) load();
});

function habitDialog(habit) {
  const isEdit = Boolean(habit);
  const init = habit || { title: '', repeat: { type: 'daily' }, startTime: '', endTime: '' };
  let type = init.repeat.type;
  const days = new Set(init.repeat.days || [1, 2, 3, 4, 5]);

  return showDialog(
    `<form class="dialog" style="width:min(460px,100%);max-height:90vh;overflow:auto;">
       <div class="dialog-title">${isEdit ? '習慣を編集' : '習慣を追加'}</div>
       <div class="field"><label>名前</label><input name="title" placeholder="例: 朝のストレッチ" required value="${escapeHtml(init.title)}" /></div>
       <div class="field">
         <label>繰り返し</label>
         <div class="seg">
           <a href="#" class="seg-opt" data-type="daily">毎日</a>
           <a href="#" class="seg-opt" data-type="days">曜日を選ぶ</a>
           <a href="#" class="seg-opt" data-type="weekly">週◯回</a>
         </div>
       </div>
       <div class="field" data-for="days">
         <label>曜日</label>
         <div class="habit-days">
           ${HABIT_DAY_ORDER.map((d) => `<button type="button" class="habit-day" data-day="${d}">${HABIT_DAY_LABELS[d]}</button>`).join('')}
         </div>
       </div>
       <div class="field" data-for="weekly">
         <label>週に何回</label>
         <input name="count" type="number" min="1" max="7" value="${init.repeat.count || 3}" />
       </div>
       <div class="field">
         <label>時間枠（任意・日間ビューのタイムラインに表示）</label>
         <div class="habit-time-row">
           <input name="startTime" type="time" value="${init.startTime || ''}" />
           <span>〜</span>
           <input name="endTime" type="time" value="${init.endTime || ''}" />
         </div>
       </div>
       <div class="habit-form-error" data-error></div>
       <div class="dialog-actions">
         <button type="button" class="btn btn-ghost" data-cancel>キャンセル</button>
         <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '追加'}</button>
       </div>
     </form>`,
    (backdrop, close) => {
      const form = backdrop.querySelector('form');
      const errorEl = backdrop.querySelector('[data-error]');
      const startEl = form.elements.startTime;
      const endEl = form.elements.endTime;

      function sync() {
        form.querySelectorAll('[data-type]').forEach((o) => o.classList.toggle('active', o.dataset.type === type));
        form.querySelectorAll('[data-for]').forEach((el) => el.classList.toggle('hidden', el.dataset.for !== type));
        form.querySelectorAll('.habit-day').forEach((b) => b.classList.toggle('active', days.has(Number(b.dataset.day))));
      }

      function validateTimes() {
        endEl.setCustomValidity('');
        if (!startEl.value && !endEl.value) return;
        if (!startEl.value || !endEl.value) endEl.setCustomValidity('開始と終了の両方を入力してください');
        else if (endEl.value <= startEl.value) endEl.setCustomValidity('終了は開始より後にしてください');
      }

      form.querySelectorAll('[data-type]').forEach((o) =>
        o.addEventListener('click', (e) => {
          e.preventDefault();
          type = o.dataset.type;
          sync();
        })
      );
      form.querySelectorAll('.habit-day').forEach((b) =>
        b.addEventListener('click', () => {
          const d = Number(b.dataset.day);
          if (days.has(d)) days.delete(d);
          else days.add(d);
          sync();
        })
      );
      startEl.addEventListener('input', validateTimes);
      endEl.addEventListener('input', validateTimes);
      backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      sync();
      form.elements.title.focus();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';
        if (type === 'days' && days.size === 0) {
          errorEl.textContent = '曜日を1つ以上選んでください。';
          return;
        }
        validateTimes();
        if (!form.reportValidity()) return;

        const repeat =
          type === 'days'
            ? { type, days: [...days] }
            : type === 'weekly'
              ? { type, count: Number(form.elements.count.value) }
              : { type: 'daily' };
        const body = {
          title: form.elements.title.value,
          repeat,
          startTime: startEl.value || null,
          endTime: endEl.value || null,
        };
        try {
          await apiSend(isEdit ? 'PUT' : 'POST', isEdit ? `/api/habits/${habit.id}` : '/api/habits', body);
          close(true);
        } catch (err) {
          errorEl.textContent = '保存できませんでした。入力内容を確認してください。';
        }
      });
    }
  );
}

load();
