const NAV_ICONS = {
  home: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path></svg>',
  stats: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
  week: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="9" x2="9" y2="21"></line><line x1="15" y1="9" x2="15" y2="21"></line></svg>',
  settings: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 13.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"></path></svg>',
};

NAV_ICONS.habit =
  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="8 12.5 11 15.5 16 9.5"></polyline></svg>';

const NAV_ITEMS = [
  { href: 'index.html', label: 'ホーム', icon: 'home' },
  { href: 'week.html', label: '週間', icon: 'week' },
  { href: 'habits.html', label: '習慣', icon: 'habit' },
  { href: 'stats.html', label: '実績・統計', icon: 'stats' },
  { href: 'settings.html', label: '設定', icon: 'settings' },
];

const NAV_PIN_KEY = 'taskapp.navPinned';

function isNavPinned() {
  try {
    return localStorage.getItem(NAV_PIN_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function applyNavPinned(pinned) {
  document.body.classList.toggle('nav-pinned', pinned);
  if (pinned) document.body.classList.remove('nav-open');
}

applyNavPinned(isNavPinned());

function setupNavToggle() {
  if (document.querySelector('.nav-toggle')) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'メニューを開く');
  toggle.setAttribute('aria-controls', 'nav-root');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <svg class="icon-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
    <svg class="icon-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
  `;

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';

  function setOpen(open) {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }

  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setOpen(false);
  });

  document.body.append(backdrop, toggle);
}

async function renderNav() {
  const current = location.pathname.split('/').pop() || 'index.html';
  const root = document.getElementById('nav-root');
  if (!root) return;

  setupNavToggle();

  root.innerHTML = `
    <div class="sidebar-brand">
      <div class="logo">f</div>
      <div class="name">Focus Task</div>
      <button type="button" class="nav-pin" id="nav-pin" aria-pressed="false" title="メニューを常に開く" aria-label="メニューを常に開く">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
      </button>
    </div>
    <nav class="sidebar-nav">
      ${NAV_ITEMS.map(
        (item) =>
          `<a href="${item.href}" class="${item.href === current ? 'active' : ''}">${NAV_ICONS[item.icon]}${item.label}</a>`
      ).join('')}
    </nav>
    <div class="sidebar-today">
      <div class="label">本日</div>
      <div class="value"><span id="sidebar-today-count">-</span> <span>ポモドーロ</span></div>
    </div>
  `;

  const pinBtn = document.getElementById('nav-pin');
  function syncPinButton() {
    const pinned = document.body.classList.contains('nav-pinned');
    pinBtn.setAttribute('aria-pressed', String(pinned));
    const label = pinned ? 'メニューの固定を解除' : 'メニューを常に開く';
    pinBtn.title = label;
    pinBtn.setAttribute('aria-label', label);
  }
  pinBtn.addEventListener('click', () => {
    const pinned = !document.body.classList.contains('nav-pinned');
    try {
      localStorage.setItem(NAV_PIN_KEY, pinned ? '1' : '0');
    } catch (e) {
      // storage unavailable — pin only lasts for this page view
    }
    applyNavPinned(pinned);
    syncPinButton();
  });
  syncPinButton();

  try {
    const { count } = await apiGet('/api/pomodoro/today-count');
    document.getElementById('sidebar-today-count').textContent = count;
  } catch (e) {
    // ignore — leave placeholder
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRIORITY_LABEL = { high: '高', medium: '中', low: '低' };
const PRIORITY_TAG_CLASS = { high: 'tag-accent', medium: 'tag-accent-2', low: 'tag-neutral' };

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function apiSend(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
  return res.json();
}

// In-page replacement for window.confirm(), which some embedded browsers suppress (always returns false).
// ダイアログの共通土台。innerHtml を表示し、setup(backdrop, close) で中身を配線する。
// close(value) で閉じて Promise を解決する（Esc・背景クリックは null）。
function showDialog(innerHtml, setup) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = innerHtml;
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
    };
    function close(value) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(value);
    }
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(null);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    setup(backdrop, close);
  });
}

// --- 習慣（habits）の表示用ヘルパー ---

const HABIT_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜始まり
const HABIT_DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function habitRepeatLabel(h) {
  const r = h.repeat;
  if (r.type === 'weekly') return `週${r.count}回`;
  if (r.type === 'days') {
    if (r.days.length === 7) return '毎日';
    return HABIT_DAY_ORDER.filter((d) => r.days.includes(d)).map((d) => HABIT_DAY_LABELS[d]).join('・');
  }
  return '毎日';
}

function habitStreakLabel(h) {
  if (!h.streak || h.streak.count <= 0) return '';
  return `🔥 ${h.streak.count}${h.streak.unit === 'week' ? '週' : '日'}連続`;
}

function habitTimeLabel(h) {
  if (!h.startTime || !h.endTime) return '';
  const trim = (t) => t.replace(/^0/, '');
  return `${trim(h.startTime)}–${trim(h.endTime)}`;
}

function confirmDialog(message, okLabel = '削除') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-title">確認</div>
        <div class="dialog-body">${escapeHtml(message)}</div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">キャンセル</button>
          <button type="button" class="btn btn-primary" data-act="ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>
    `;

    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    function close(result) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) return close(false);
      const btn = e.target.closest('[data-act]');
      if (btn) close(btn.dataset.act === 'ok');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-act="ok"]').focus();
  });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ja-JP');
}

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}

document.addEventListener('DOMContentLoaded', renderNav);

// PWA: オフラインでもアプリ本体を開けるよう Service Worker を登録する（localhost / HTTPS のみ有効）。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
