const taskId = new URLSearchParams(location.search).get('id');
const contentEl = document.getElementById('content');
let editPriority = 'medium';

async function toggleTaskStatus(id, currentStatus) {
  await apiSend('PUT', `/api/tasks/${id}`, { status: currentStatus === 'done' ? 'todo' : 'done' });
  render();
}

async function deleteTask(id) {
  await apiDelete(`/api/tasks/${id}`);
  location.href = 'index.html';
}

function renderSubtasks(subtasks) {
  if (subtasks.length === 0) return '<p class="text-muted" style="font-size:13px;">サブタスクはありません。</p>';
  return `<div style="display:flex;flex-direction:column;gap:8px;">${subtasks
    .map(
      (s) => `
    <div class="card" data-id="${s.id}">
      <div class="task-item">
        <input type="checkbox" class="sub-toggle" data-id="${s.id}" data-status="${s.status}" ${s.status === 'done' ? 'checked' : ''} />
        <a class="title ${s.status === 'done' ? 'done' : ''}" href="task.html?id=${s.id}">${escapeHtml(s.title)}</a>
      </div>
    </div>
  `
    )
    .join('')}</div>`;
}

function prioritySegHtml(current) {
  return ['high', 'medium', 'low']
    .map(
      (p) =>
        `<a href="#" class="seg-opt ${p === current ? 'active' : ''}" data-value="${p}">${PRIORITY_LABEL[p]}</a>`
    )
    .join('');
}

async function render() {
  if (!taskId) {
    contentEl.innerHTML = '<p>タスクが指定されていません。</p>';
    return;
  }

  let task;
  try {
    task = await apiGet(`/api/tasks/${taskId}`);
  } catch (e) {
    contentEl.innerHTML = '<p>タスクが見つかりません。</p>';
    return;
  }
  const subtasks = await apiGet(`/api/tasks/${taskId}/subtasks`);
  editPriority = task.priority;

  contentEl.innerHTML = `
    <h1>タスク詳細</h1>
    <form id="edit-form" class="card" style="margin-bottom:20px;">
      <div class="field"><label>タイトル</label><input name="title" value="${escapeHtml(task.title)}" required /></div>
      <div class="field"><label>詳細</label><textarea name="description" rows="3">${escapeHtml(task.description || '')}</textarea></div>
      <div class="field"><label>期限</label><input name="dueDate" type="datetime-local" value="${toLocalInputValue(task.dueDate)}" /></div>
      <div class="field">
        <label>優先度</label>
        <div class="seg" id="edit-priority-seg">${prioritySegHtml(task.priority)}</div>
      </div>
      <div class="field"><label>タグ（カンマ区切り）</label><input name="tags" value="${escapeHtml((task.tags || []).join(', '))}" placeholder="タグ（カンマ区切り）" /></div>
      <div class="field"><label>見積もり時間（分・任意）</label><input name="estimateMinutes" type="number" min="1" placeholder="例: 30" value="${task.estimateMinutes || ''}" /></div>
      <button type="submit" class="btn btn-primary" style="align-self:flex-start;">保存</button>
    </form>

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <label class="radio">
        <input type="checkbox" id="status-toggle" ${task.status === 'done' ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--color-accent);" />
        完了にする
      </label>
      <button class="btn btn-secondary" id="delete-btn" type="button" style="color:var(--color-accent-700);margin-left:auto;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        削除
      </button>
    </div>

    <h2>サブタスク</h2>
    <div id="subtask-list" style="margin-bottom:12px;">${renderSubtasks(subtasks)}</div>

    <form id="subtask-form" class="card" style="flex-direction:row;gap:8px;align-items:center;">
      <input name="title" placeholder="サブタスクのタイトル" required style="flex:1;" />
      <button type="submit" class="btn btn-primary" style="flex:0 0 auto;">追加</button>
    </form>
  `;

  const editPrioritySeg = document.getElementById('edit-priority-seg');
  editPrioritySeg.querySelectorAll('.seg-opt').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.preventDefault();
      editPriority = opt.dataset.value;
      editPrioritySeg.querySelectorAll('.seg-opt').forEach((o) => o.classList.toggle('active', o === opt));
    });
  });

  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    await apiSend('PUT', `/api/tasks/${taskId}`, {
      title: data.get('title'),
      description: data.get('description'),
      dueDate: fromLocalInputValue(data.get('dueDate')),
      priority: editPriority,
      estimateMinutes: data.get('estimateMinutes') ? Number(data.get('estimateMinutes')) : null,
      tags: String(data.get('tags') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    render();
  });

  document.getElementById('status-toggle').addEventListener('change', () => toggleTaskStatus(task.id, task.status));
  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (await confirmDialog('このタスクを削除しますか？')) deleteTask(task.id);
  });

  document.getElementById('subtask-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    await apiSend('POST', '/api/tasks', { title: data.get('title'), parentTaskId: task.id });
    render();
  });

  contentEl.querySelectorAll('.sub-toggle').forEach((el) => {
    el.addEventListener('change', () => toggleTaskStatus(el.dataset.id, el.dataset.status));
  });
}

render();
