// スマホ版 タスク: 絞り込み・並び替え・チェック・追加。削除は詳細画面から（一覧の情報を減らすため）。

const taskState = { status: 'todo', sortBy: 'dueDate' };
const filtersEl = document.getElementById('m-filters');
const taskListEl = document.getElementById('m-task-list');
const taskCountEl = document.getElementById('m-count');

const STATUS_OPTIONS = [
  ['todo', '未完了'],
  ['done', '完了'],
  ['all', 'すべて'],
];
const SORT_OPTIONS = [
  ['dueDate', '期限順'],
  ['priority', '優先度順'],
];

function renderFilters() {
  const seg = (key, options) =>
    `<div class="seg">${options
      .map(([v, label]) => `<a href="#" class="seg-opt ${taskState[key] === v ? 'active' : ''}" data-key="${key}" data-value="${v}">${label}</a>`)
      .join('')}</div>`;
  filtersEl.innerHTML = seg('status', STATUS_OPTIONS) + seg('sortBy', SORT_OPTIONS);
}

async function loadTasks() {
  const query = new URLSearchParams({ sortBy: taskState.sortBy });
  if (taskState.status !== 'all') query.set('status', taskState.status);
  const tasks = await apiGet(`/api/tasks?${query}`);
  taskCountEl.textContent = `${tasks.length}件`;
  taskListEl.innerHTML =
    tasks.length === 0
      ? `<p class="m-empty">${taskState.status === 'done' ? '完了したタスクはありません。' : 'タスクはありません。＋ から追加できます。'}</p>`
      : tasks.map(mTaskRow).join('');
}

filtersEl.addEventListener('click', (e) => {
  const opt = e.target.closest('.seg-opt');
  if (!opt) return;
  e.preventDefault();
  taskState[opt.dataset.key] = opt.dataset.value;
  renderFilters();
  loadTasks();
});

taskListEl.addEventListener('click', async (e) => {
  const check = e.target.closest('.m-check');
  if (!check) return;
  await mToggleTask(check);
  loadTasks();
});

// --- 追加（下から出るシート） ---

function addTaskDialog() {
  let priority = 'medium';
  return showDialog(
    `<form class="dialog">
       <div class="dialog-title">新しいタスク</div>
       <div class="field"><label>タイトル</label><input name="title" placeholder="何をしますか？" required /></div>
       <div class="field"><label>期限</label><input name="dueDate" type="datetime-local" /></div>
       <div class="field">
         <label>優先度</label>
         <div class="seg" id="m-new-priority">
           <a href="#" class="seg-opt" data-value="high">高</a>
           <a href="#" class="seg-opt active" data-value="medium">中</a>
           <a href="#" class="seg-opt" data-value="low">低</a>
         </div>
       </div>
       <div class="field"><label>見積もり時間（分・任意）</label><input name="estimateMinutes" type="number" min="1" inputmode="numeric" placeholder="例: 30" /></div>
       <details class="m-details">
         <summary>詳細・タグ</summary>
         <div class="field" style="margin-top:8px;"><label>詳細</label><textarea name="description" rows="2"></textarea></div>
         <div class="field" style="margin-top:8px;"><label>タグ（カンマ区切り）</label><input name="tags" /></div>
       </details>
       <div class="dialog-actions">
         <button type="button" class="btn btn-ghost" data-cancel>キャンセル</button>
         <button type="submit" class="btn btn-primary">追加</button>
       </div>
     </form>`,
    (backdrop, close) => {
      const form = backdrop.querySelector('form');
      backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(false));
      backdrop.querySelectorAll('#m-new-priority .seg-opt').forEach((opt) =>
        opt.addEventListener('click', (e) => {
          e.preventDefault();
          priority = opt.dataset.value;
          backdrop.querySelectorAll('#m-new-priority .seg-opt').forEach((o) => o.classList.toggle('active', o === opt));
        })
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        await apiSend('POST', '/api/tasks', {
          title: data.get('title'),
          description: data.get('description'),
          dueDate: fromLocalInputValue(data.get('dueDate')),
          priority,
          estimateMinutes: data.get('estimateMinutes') ? Number(data.get('estimateMinutes')) : null,
          tags: String(data.get('tags') || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        });
        close(true);
      });
      form.elements.title.focus();
    }
  );
}

document.getElementById('m-add').addEventListener('click', async () => {
  if (await addTaskDialog()) loadTasks();
});

renderFilters();
loadTasks();
