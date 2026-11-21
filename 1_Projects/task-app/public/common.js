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

const ICON_SUN =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>';
const ICON_MOON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';

function railLink(item, current) {
  const active = item.href === current;
  return `<a href="${item.href}" class="rail-link ${active ? 'active' : ''}" title="${item.label}" aria-label="${item.label}"${active ? ' aria-current="page"' : ''}>${NAV_ICONS[item.icon]}<span class="rail-tip">${item.label}</span></a>`;
}

// 左のアイコンレール（PC 専用）
function renderRail() {
  const root = document.getElementById('nav-root');
  const current = location.pathname.split('/').pop() || 'index.html';
  const settings = NAV_ITEMS.find((i) => i.icon === 'settings');
  root.innerHTML = `
    <nav class="rail-group" aria-label="メインメニュー">${NAV_ITEMS.filter((i) => i !== settings)
      .map((i) => railLink(i, current))
      .join('')}</nav>
    <nav class="rail-group" aria-label="設定">${railLink(settings, current)}</nav>
  `;
}

// 上のバー: ブランド・今日の日付とポモドーロ数・テーマ切り替え・タスク追加
function renderTopbar() {
  if (document.getElementById('topbar')) return;
  const now = new Date();
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日（${['日', '月', '火', '水', '木', '金', '土'][now.getDay()]}）`;

  const bar = document.createElement('header');
  bar.id = 'topbar';
  bar.className = 'topbar';
  bar.innerHTML = `
    <a class="topbar-brand" href="index.html"><span class="topbar-logo">f</span>Focus Task</a>
    <div class="topbar-right">
      <span class="topbar-chip">${dateText}</span>
      <span class="topbar-chip" id="topbar-pomo" title="今日のポモドーロ数">🍅 <b id="sidebar-today-count">-</b></span>
      <button type="button" class="icon-btn" id="theme-quick" aria-label="ライト / ダークを切り替え"></button>
      <button type="button" class="btn-orange" id="topbar-new">＋ タスク追加</button>
    </div>
  `;
  document.body.prepend(bar);

  const themeBtn = document.getElementById('theme-quick');
  const syncThemeBtn = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeBtn.innerHTML = dark ? ICON_SUN : ICON_MOON;
    themeBtn.title = dark ? 'ライトにする' : 'ダークにする';
  };
  themeBtn.addEventListener('click', () => setThemePref(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.addEventListener('taskapp:themechange', syncThemeBtn);
  syncThemeBtn();

  // 追加ボタン: Home ならそのままモーダルを開き、他のページでは Home へ移動して開く
  document.getElementById('topbar-new').addEventListener('click', () => {
    if (typeof window.onNewTask === 'function') window.onNewTask();
    else location.href = 'index.html?new=1';
  });
}

async function renderNav() {
  if (!document.getElementById('nav-root')) return;
  renderRail();
  renderTopbar();

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

// サーバーに届かないとき（停止中・通信断）は、画面の上に警告を出し、つながり次第ページを読み込み直す。
// 画面だけがキャッシュから開いて「データが消えた」ように見えるのを防ぐ。
let offlineBanner = null;
let offlineTimer = null;

function showOfflineBanner() {
  if (offlineBanner) return;
  offlineBanner = document.createElement('div');
  offlineBanner.className = 'offline-banner';
  offlineBanner.setAttribute('role', 'alert');
  offlineBanner.innerHTML =
    '<span><b>サーバーに接続できません。</b> データは消えていません。サーバーが起動しているか確認してください。</span>' +
    '<button type="button" class="offline-retry">再読み込み</button>';
  offlineBanner.querySelector('button').addEventListener('click', () => location.reload());
  document.body.prepend(offlineBanner);

  // つながるまで 5 秒おきに確かめ、戻ったら読み込み直す
  offlineTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/pomodoro/today-count', { cache: 'no-store' });
      if (res.ok) location.reload();
    } catch {
      // まだつながらない
    }
  }, 5000);
}

// fetch の失敗（TypeError）はネットワーク断。HTTP エラー（4xx/5xx）はサーバーが生きているので対象外。
async function apiFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (e) {
    showOfflineBanner();
    throw e;
  }
}

async function apiGet(url) {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function apiSend(method, url, body) {
  const res = await apiFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.json();
}

async function apiDelete(url) {
  const res = await apiFetch(url, { method: 'DELETE' });
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

// --- テーマ（ライト / ダーク / システム設定に合わせる） ---
// 初回描画のちらつきを避けるため、起動時の適用は各ページの <head> のインラインスクリプトでも行っている。

const THEME_KEY = 'taskapp.theme';
const THEME_MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

function getThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && THEME_MEDIA.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function setThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // 保存できない環境でも、この画面では切り替わる
  }
  applyTheme(pref);
  document.dispatchEvent(new Event('taskapp:themechange'));
}

THEME_MEDIA.addEventListener('change', () => applyTheme(getThemePref()));
// 別のタブで変更されたときも追従する
window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY) applyTheme(getThemePref());
});

// data-el 属性でページ内の要素を探す（PC / スマホ共通）
function scoped(root, name) {
  return Array.from(root.querySelectorAll(`[data-el="${name}"]`));
}
