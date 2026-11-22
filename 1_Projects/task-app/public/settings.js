const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

const workInput = document.getElementById('work-minutes');
const breakInput = document.getElementById('break-minutes');
const savedMsg = document.getElementById('saved-msg');

function loadMinutes(key, fallback) {
  const stored = window.localStorage.getItem(key);
  const n = Number(stored);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

workInput.value = loadMinutes('taskapp.workMinutes', DEFAULT_WORK_MINUTES);
breakInput.value = loadMinutes('taskapp.breakMinutes', DEFAULT_BREAK_MINUTES);

document.getElementById('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  window.localStorage.setItem('taskapp.workMinutes', String(Number(workInput.value)));
  window.localStorage.setItem('taskapp.breakMinutes', String(Number(breakInput.value)));
  savedMsg.style.display = '';
  setTimeout(() => {
    savedMsg.style.display = 'none';
  }, 2000);
});

// 表示テーマ（選んだ時点で保存・反映する）
const themeSeg = document.getElementById('theme-seg');
function renderThemeSeg() {
  const pref = getThemePref();
  themeSeg.querySelectorAll('.seg-opt').forEach((opt) => {
    const on = opt.dataset.themePref === pref;
    opt.classList.toggle('active', on);
    opt.setAttribute('aria-checked', String(on));
  });
}
themeSeg.querySelectorAll('.seg-opt').forEach((opt) => {
  opt.addEventListener('click', (e) => {
    e.preventDefault();
    setThemePref(opt.dataset.themePref);
    renderThemeSeg();
  });
});
renderThemeSeg();
document.addEventListener('taskapp:themechange', renderThemeSeg);

// タグ（あらかじめ作っておく一覧。サーバーに保存するので PC・スマホで共通）
const tagListEl = document.getElementById('tag-list');
const tagFormEl = document.getElementById('tag-form');
const tagInputEl = document.getElementById('tag-input');
const tagErrorEl = document.getElementById('tag-error');

function showTagError(msg) {
  tagErrorEl.textContent = msg || '';
  tagErrorEl.hidden = !msg;
}

async function renderTagList() {
  const tags = await apiGet('/api/tags');
  tagListEl.innerHTML = tags.length
    ? tags
        .map(
          (t) =>
            `<span class="tag-chip">#${escapeHtml(t)}<button type="button" class="tag-chip-del" data-tag="${escapeHtml(t)}" aria-label="タグ「${escapeHtml(t)}」を削除">×</button></span>`
        )
        .join('')
    : '<span class="text-muted" style="font-size:13px;">まだタグがありません。下の欄から追加できます。</span>';
}

tagListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.tag-chip-del');
  if (!btn) return;
  showTagError('');
  await apiDelete(`/api/tags/${encodeURIComponent(btn.dataset.tag)}`);
  renderTagList();
});

tagFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  showTagError('');
  const res = await apiFetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tagInputEl.value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showTagError(body.error || 'タグを追加できませんでした');
    return;
  }
  tagInputEl.value = '';
  renderTagList();
});

renderTagList();
