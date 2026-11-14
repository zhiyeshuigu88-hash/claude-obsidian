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
  if (!listEl || !formEl) return;

  async function fetchEntries() {
    const res = await fetch(`/api/${resource}`);
    const entries = (await res.json()).slice().reverse();
    render(entries);
  }

  function render(entries) {
    if (entries.length === 0) {
      listEl.innerHTML = `<li class="empty">${resource === 'board' ? 'まだ投稿はありません。' : 'まだメモはありません。'}</li>`;
      return;
    }
    listEl.innerHTML = entries.map(e => `
      <li class="item" data-id="${e.id}">
        <div class="item-head">
          <time class="meta">${e.date} ${e.time}</time>
          <button class="del" data-id="${e.id}" aria-label="この投稿を削除">削除</button>
        </div>
        <p class="content">${escapeHtml(e.content)}</p>
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
  const imagesEl = document.getElementById('diary-images');
  const drawBtn = document.getElementById('diary-draw');
  if (!textareaEl) return;

  let currentDate = formatDate(new Date());
  let loadedContent = '';
  let saveTimer = null;
  let images = []; // 手書き画像のファイル名（日記の末尾に Markdown の画像として保存）

  const IMAGE_LINE = /^!\[[^\]]*\]\(attachments\/([^)]+\.png)\)\s*$/;

  // 保存された日記の文章から、手書き画像の行を取り出す
  function parseContent(raw) {
    const text = [];
    const found = [];
    raw.split('\n').forEach((line) => {
      const m = line.match(IMAGE_LINE);
      if (m) found.push(m[1]);
      else text.push(line);
    });
    return { text: text.join('\n').replace(/^\n+|\n+$/g, ''), images: found };
  }

  // 画面上の文章と手書き画像を、保存する Markdown にまとめる（画像は末尾にまとめて並べる）
  function compose() {
    const imageLines = images.map((n) => `![手書き](attachments/${n})`).join('\n');
    const text = textareaEl.value;
    if (!imageLines) return text;
    return text.trim() ? `${text.replace(/\s+$/, '')}\n\n${imageLines}` : imageLines;
  }

  function renderImages() {
    if (!imagesEl) return;
    imagesEl.innerHTML = images.map((n) => `
      <div class="hw-item">
        <img src="/attachments/${encodeURIComponent(n)}" alt="手書き">
        <button type="button" class="hw-del" data-name="${n}">削除</button>
      </div>
    `).join('');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dateLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WEEKDAYS[d.getDay()]})`;
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
      listEl.innerHTML = '<div class="empty">まだ日記はありません。</div>';
      return;
    }
    listEl.innerHTML = entries.map(e => `
      <button type="button" class="written-item${e.date === currentDate ? ' active' : ''}" data-date="${e.date}"${e.date === currentDate ? ' aria-current="date"' : ''}>
        <span class="written-date">${e.date}</span>
        <span class="written-preview">${escapeHtml(e.preview || '(空)')}</span>
      </button>
    `).join('');
  }

  async function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const content = compose();
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
    statusEl.textContent = `● Obsidianに保存しました ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
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
    const parsed = parseContent(data.content);
    textareaEl.value = parsed.text;
    images = parsed.images;
    renderImages();
    loadedContent = compose();
    statusEl.textContent = '';
    fetchList();
  }

  document.getElementById('diary-prev').addEventListener('click', () => loadDate(shiftDate(currentDate, -1)));
  document.getElementById('diary-next').addEventListener('click', () => loadDate(shiftDate(currentDate, 1)));
  document.getElementById('diary-today').addEventListener('click', () => loadDate(formatDate(new Date())));

  textareaEl.addEventListener('input', scheduleAutosave);
  textareaEl.addEventListener('blur', () => flushPending());

  window.addEventListener('beforeunload', () => {
    if (compose() === loadedContent) return;
    fetch(`/api/diary/${currentDate}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: compose() }),
      keepalive: true,
    });
  });

  if (drawBtn && window.openHandwriting) {
    drawBtn.addEventListener('click', async () => {
      await flushPending();
      const blob = await window.openHandwriting();
      if (!blob) return;
      statusEl.textContent = '手書きを保存中…';
      try {
        const res = await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: blob,
        });
        if (!res.ok) throw new Error('upload failed');
        const { name } = await res.json();
        images.push(name);
        renderImages();
        await save();
      } catch (err) {
        statusEl.textContent = '手書きの保存に失敗しました。もう一度お試しください。';
      }
    });
  }

  if (imagesEl) {
    imagesEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.hw-del');
      if (!btn) return;
      if (!confirm('この手書きを削除しますか？（元に戻せません）')) return;
      const name = btn.dataset.name;
      images = images.filter((n) => n !== name);
      renderImages();
      await save();
      await fetch(`/api/attachments/${encodeURIComponent(name)}`, { method: 'DELETE' });
    });
  }

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.written-item[data-date]');
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

// ライト / ダークの切り替え（選択は端末に保存。未選択のあいだは端末の設定に従う）
(function setupTheme() {
  var btn = document.getElementById("theme-toggle");
  var root = document.documentElement;
  var meta = document.querySelector("meta[name=theme-color]");
  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  function apply(theme) {
    root.dataset.theme = theme;
    if (meta) meta.content = theme === "dark" ? "#1d1a17" : "#f7f3ea";
    btn.setAttribute("aria-label", theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え");
  }
  function saved() {
    try { return localStorage.getItem("folio.theme"); } catch (e) { return null; }
  }

  apply(root.dataset.theme === "dark" ? "dark" : "light");
  btn.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
    try { localStorage.setItem("folio.theme", next); } catch (e) {}
  });
  mq.addEventListener("change", function (e) {
    if (!saved()) apply(e.matches ? "dark" : "light");
  });
})();
