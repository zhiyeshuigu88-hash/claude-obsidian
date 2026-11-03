function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setupBoard(resource, listId, formId) {
  const listEl = document.getElementById(listId);
  const formEl = document.getElementById(formId);

  async function fetchEntries() {
    const res = await fetch(`/api/${resource}`);
    const entries = (await res.json()).slice().reverse();
    render(entries);
  }

  function render(entries) {
    if (entries.length === 0) {
      listEl.innerHTML = '<li class="empty">まだありません</li>';
      return;
    }
    listEl.innerHTML = entries.map(e => `
      <li class="item" data-id="${e.id}">
        <span class="meta">${e.date} ${e.time}</span>
        <span class="content">${escapeHtml(e.content)}</span>
        <button class="del" data-id="${e.id}" title="削除">✕</button>
      </li>
    `).join('');
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = new FormData(formEl).get('content');
    if (!content || !String(content).trim()) return;
    await fetch(`/api/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    formEl.reset();
    fetchEntries();
  });

  listEl.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('del')) return;
    await fetch(`/api/${resource}/${e.target.dataset.id}`, { method: 'DELETE' });
    fetchEntries();
  });

  fetchEntries();
}

setupBoard('board', 'board-list', 'board-form');
setupBoard('ideas', 'idea-list', 'idea-form');

function setupDiary() {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const AUTOSAVE_DELAY = 800;
  const textareaEl = document.getElementById('diary-textarea');
  const dateLabelEl = document.getElementById('diary-date-label');
  const statusEl = document.getElementById('diary-status');
  const listEl = document.getElementById('diary-list');

  let currentDate = formatDate(new Date());
  let loadedContent = '';
  let saveTimer = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dateLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return `${dateStr} (${WEEKDAYS[d.getDay()]})`;
  }

  function shiftDate(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }

  async function fetchList() {
    const res = await fetch('/api/diary');
    const entries = await res.json();
    renderList(entries);
  }

  function renderList(entries) {
    if (entries.length === 0) {
      listEl.innerHTML = '<li class="empty">まだ日記がありません</li>';
      return;
    }
    listEl.innerHTML = entries.map(e => `
      <li class="item${e.date === currentDate ? ' active' : ''}" data-date="${e.date}">
        <span class="meta">${e.date}</span>
        <span class="content">${escapeHtml(e.preview || '(空)')}</span>
      </li>
    `).join('');
  }

  async function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const content = textareaEl.value;
    if (content === loadedContent) {
      statusEl.textContent = '';
      return;
    }
    const dateBeingSaved = currentDate;
    statusEl.textContent = '保存中…';
    await fetch(`/api/diary/${dateBeingSaved}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (dateBeingSaved !== currentDate) return;
    loadedContent = content;
    statusEl.textContent = `Obsidianに保存しました ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
    fetchList();
  }

  function scheduleAutosave() {
    clearTimeout(saveTimer);
    statusEl.textContent = '入力中…';
    saveTimer = setTimeout(save, AUTOSAVE_DELAY);
  }

  async function flushPending() {
    if (saveTimer) await save();
  }

  async function loadDate(dateStr) {
    await flushPending();
    currentDate = dateStr;
    dateLabelEl.textContent = dateLabel(dateStr);
    const res = await fetch(`/api/diary/${dateStr}`);
    const data = await res.json();
    loadedContent = data.content;
    textareaEl.value = data.content;
    statusEl.textContent = '';
    fetchList();
  }

  document.getElementById('diary-prev').addEventListener('click', () => loadDate(shiftDate(currentDate, -1)));
  document.getElementById('diary-next').addEventListener('click', () => loadDate(shiftDate(currentDate, 1)));
  document.getElementById('diary-today').addEventListener('click', () => loadDate(formatDate(new Date())));

  textareaEl.addEventListener('input', scheduleAutosave);
  textareaEl.addEventListener('blur', () => flushPending());

  window.addEventListener('beforeunload', () => {
    if (textareaEl.value === loadedContent) return;
    fetch(`/api/diary/${currentDate}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: textareaEl.value }),
      keepalive: true,
    });
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.item[data-date]');
    if (!item) return;
    loadDate(item.dataset.date);
  });

  loadDate(currentDate);
}

setupDiary();

// PWA: オフラインでもアプリ本体を開けるよう Service Worker を登録する（localhost / HTTPS のみ有効）。
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
