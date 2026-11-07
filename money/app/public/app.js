/**
 * 家計管理アプリ フェーズ1 フロントエンド（フレームワークなし）。
 *
 * 画面はホーム1枚。§3 の設計指針どおり「残額表示」と「入力ボタン」に全振りする。
 * 分析グラフ・固定費管理・一覧フィルタはフェーズ2以降なので出さない。
 */

const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const signedYen = (n) => (n < 0 ? '−' : '') + yen(Math.abs(n));

const state = { periodLabel: null, data: null, draftCategory: null };

const el = {
  app: document.getElementById('app'),
  fab: document.getElementById('fab'),
  entryDialog: document.getElementById('entry-dialog'),
  entryForm: document.getElementById('entry-form'),
  entryError: document.getElementById('entry-error'),
  entrySubmit: document.getElementById('entry-submit'),
  amount: document.getElementById('amount'),
  spentOn: document.getElementById('spentOn'),
  storeName: document.getElementById('storeName'),
  memo: document.getElementById('memo'),
  quickAmounts: document.getElementById('quick-amounts'),
  categoryChips: document.getElementById('category-chips'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsForm: document.getElementById('settings-form'),
  settingsError: document.getElementById('settings-error'),
  periodBudget: document.getElementById('periodBudget'),
  fixedCostTotal: document.getElementById('fixedCostTotal'),
};

const QUICK_AMOUNTS = [200, 500, 1000, 3000];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  // セッション切れ: 認証系 API 以外で 401 が返ったらログイン画面へ戻す
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    showAuth(false);
    const err = new Error(body.error || 'ログインが必要です');
    err.unauthorized = true; // ログイン画面を出し済み。呼び出し側のエラー表示で上書きしない
    throw err;
  }
  if (!res.ok) throw new Error(body.error || `エラー (${res.status})`);
  return body;
}

async function load() {
  const query = state.periodLabel ? `?period=${encodeURIComponent(state.periodLabel)}` : '';
  state.data = await api('/api/state' + query);
  render();
}

function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(node._t);
  node._t = setTimeout(() => node.classList.remove('show'), 1800);
}

/* ---------- レンダリング ---------- */

function render() {
  const d = state.data;
  el.fab.hidden = false;

  const hasBudget = d.settings.periodBudget > 0;

  el.app.innerHTML = [
    renderPeriodBar(d),
    hasBudget ? renderHero(d) : renderBudgetHint(),
    renderSummary(d),
    d.isCurrent ? renderToday(d) : '',
    renderBreakdown(d),
    `<button class="settings-link" data-open-settings>予算・固定費の設定</button>`,
    `<p class="account-line"><button class="settings-link inline" data-logout>ログアウト</button></p>`,
  ].join('');

  bindDynamic();
}

/* ---------- 認証画面（要件定義書 §7.7: メール + パスワード、登録は最初の1人だけ） ---------- */

function showAuth(needsSetup) {
  state.data = null;
  state.periodLabel = null;
  el.fab.hidden = true;
  for (const d of [el.entryDialog, el.settingsDialog]) if (d.open) d.close();

  el.app.innerHTML = `
    <form class="auth-card" id="auth-form" novalidate>
      <h1>${needsSetup ? 'はじめに: パスワード設定' : 'ログイン'}</h1>
      <p class="note">
        ${needsSetup
          ? 'このアプリは自分専用です。最初に設定したパスワードだけで入れます。以降の新規登録はできません。パスワードの再設定機能はないので、控えておいてください。'
          : 'パスワードを入力してください。'}
      </p>
      <label class="field">
        <span>パスワード${needsSetup ? '（8文字以上）' : ''}</span>
        <input id="auth-password" type="password"
               autocomplete="${needsSetup ? 'new-password' : 'current-password'}"
               ${needsSetup ? 'minlength="8"' : ''} required />
      </label>
      <p class="form-error" id="auth-error" hidden></p>
      <button class="primary" id="auth-submit" type="submit">${needsSetup ? 'パスワードを設定' : 'ログイン'}</button>
    </form>`;

  const form = document.getElementById('auth-form');
  const errorBox = document.getElementById('auth-error');
  const submit = document.getElementById('auth-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;
    try {
      await api(needsSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: document.getElementById('auth-password').value }),
      });
      await load();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById('auth-password').focus();
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    showAuth(false);
  }
}

async function start() {
  const status = await api('/api/auth/status');
  if (!status.authenticated) return showAuth(status.needsSetup);
  await load();
}

function renderPeriodBar(d) {
  return `
    <div class="period-bar">
      <button data-period="${d.prevPeriodLabel}" aria-label="前の期間">‹</button>
      <div class="period-title">
        <strong>${d.period.displayLabel}</strong>
        <span>${d.period.displayRange}${d.isCurrent ? '（今期）' : ''}</span>
      </div>
      <button data-period="${d.nextPeriodLabel}" aria-label="次の期間" ${d.hasNextPeriod ? '' : 'disabled'}>›</button>
    </div>`;
}

function renderBudgetHint() {
  return `
    <div class="budget-hint">
      期間予算がまだ未設定です。<br />
      「今日つかえる額」を出すには予算の入力が必要です。
      <br /><button data-open-settings>予算を設定する</button>
    </div>`;
}

function renderHero(d) {
  const a = d.allowance;
  if (a.status === 'over') {
    return `
      <div class="hero over">
        <div class="caption">予算を超過中</div>
        <div class="figure">− ${yen(a.overspent)}</div>
        <div class="sub">残り ${d.remainingDays}日 ・ 変動費 ${yen(d.period_totals.variableSpent)}</div>
        <div class="meter"><i class="over" style="width:100%"></i></div>
      </div>`;
  }
  const pct = Math.min(100, Math.round(a.usageRate * 100));
  const cls = pct >= 90 ? 'over' : pct >= 70 ? 'warn' : '';
  return `
    <div class="hero">
      <div class="caption">${d.isCurrent ? '今日つかえる' : 'この期間の残額'}</div>
      <div class="figure">${yen(d.isCurrent ? a.dailyAllowance : a.remaining)}</div>
      <div class="sub">
        ${d.isCurrent ? `残り ${d.remainingDays}日 ・ ` : ''}残額 ${yen(a.remaining)} / ${yen(a.variableBudget)}
      </div>
      <div class="meter"><i class="${cls}" style="width:${pct}%"></i></div>
    </div>`;
}

function renderSummary(d) {
  const t = d.period_totals;
  return `
    <div class="grid">
      <div class="stat"><div class="k">今日の支出</div><div class="v">${yen(d.today_total)}</div></div>
      <div class="stat"><div class="k">期間の変動費</div><div class="v">${yen(t.variableSpent)}</div></div>
      <div class="stat sub-line"><div class="k">期間の固定費</div><div class="v">${yen(t.fixedCostTotal)}</div></div>
      <div class="stat sub-line"><div class="k">期間の合計</div><div class="v">${yen(t.total)}</div></div>
    </div>`;
}

function renderToday(d) {
  const rows = d.todays_expenses.length
    ? d.todays_expenses.map((e) => expenseRow(e, d)).join('')
    : `<div class="empty">今日の支出はまだありません</div>`;
  return `
    <section>
      <div class="section-head">
        <h2>今日の支出</h2><span class="total">${yen(d.today_total)}</span>
      </div>
      <div class="list">${rows}</div>
    </section>`;
}

function expenseRow(e, d) {
  const cat = d.categories.find((c) => c.id === e.categoryId);
  const meta = [cat ? cat.name : '未分類', e.storeName, e.memo].filter(Boolean).join(' ・ ');
  return `
    <div class="row">
      <span class="dot" style="background:${cat ? cat.color : '#adb5bd'}"></span>
      <div class="desc">
        <div class="name">${escapeHtml(e.memo || e.storeName || (cat ? cat.name : '支出'))}</div>
        <div class="meta">${escapeHtml(meta)}</div>
      </div>
      <span class="amt">${yen(e.amount)}</span>
      <button class="del" data-del="${e.id}" aria-label="削除">✕</button>
    </div>`;
}

function renderBreakdown(d) {
  if (!d.category_breakdown.length) return '';
  const max = Math.max(...d.category_breakdown.map((c) => c.amount));
  const rows = d.category_breakdown.map((c) => {
    const cat = d.categories.find((x) => x.id === c.categoryId);
    return `
      <div class="bar-row">
        <span class="label">${escapeHtml(c.name)}</span>
        <span class="track"><i style="width:${Math.round((c.amount / max) * 100)}%;background:${cat ? cat.color : '#adb5bd'}"></i></span>
        <span class="val">${yen(c.amount)}</span>
      </div>`;
  }).join('');
  return `
    <section class="breakdown">
      <div class="section-head"><h2>カテゴリ別（この期間）</h2></div>
      <div class="list" style="padding:8px 14px">${rows}</div>
    </section>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------- イベント ---------- */

function bindDynamic() {
  el.app.querySelectorAll('[data-period]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.disabled) return;
      state.periodLabel = b.dataset.period;
      load().catch(showFatal);
    });
  });
  el.app.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('この支出を削除しますか？')) return;
      try {
        await api('/api/expenses/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' });
        toast('削除しました');
        await load();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  el.app.querySelectorAll('[data-open-settings]').forEach((b) => {
    b.addEventListener('click', openSettings);
  });
  el.app.querySelectorAll('[data-logout]').forEach((b) => {
    b.addEventListener('click', () => logout().catch(showFatal));
  });
}

function openEntry() {
  el.entryError.hidden = true;
  el.entryForm.reset();
  state.draftCategory = null;
  el.spentOn.value = state.data.today;
  renderQuickAmounts();
  renderCategoryChips();
  el.entryDialog.showModal();
  setTimeout(() => el.amount.focus(), 50);
}

function renderQuickAmounts() {
  el.quickAmounts.innerHTML = QUICK_AMOUNTS
    .map((v) => `<button type="button" data-amt="${v}">+${yen(v)}</button>`)
    .join('');
  el.quickAmounts.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const current = parseInt(el.amount.value.replace(/[^0-9]/g, ''), 10) || 0;
      el.amount.value = String(current + Number(b.dataset.amt));
    });
  });
}

function renderCategoryChips() {
  el.categoryChips.innerHTML = state.data.categories
    .map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="false">${escapeHtml(c.name)}</button>`)
    .join('');
  el.categoryChips.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const isOn = b.getAttribute('aria-pressed') === 'true';
      el.categoryChips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', isOn ? 'false' : 'true');
      state.draftCategory = isOn ? null : b.dataset.cat;
    });
  });
}

el.entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.entryError.hidden = true;
  el.entrySubmit.disabled = true;
  try {
    const amount = parseInt(String(el.amount.value).replace(/[^0-9]/g, ''), 10);
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        categoryId: state.draftCategory,
        spentOn: el.spentOn.value,
        storeName: el.storeName.value,
        memo: el.memo.value,
      }),
    });
    el.entryDialog.close();
    toast('保存しました');
    await load();
  } catch (err) {
    el.entryError.textContent = err.message;
    el.entryError.hidden = false;
  } finally {
    el.entrySubmit.disabled = false;
  }
});

async function openSettings() {
  el.settingsError.hidden = true;
  const s = await api('/api/settings');
  el.periodBudget.value = s.periodBudget || '';
  el.fixedCostTotal.value = s.fixedCostTotal || '';
  el.settingsDialog.showModal();
}

el.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.settingsError.hidden = true;
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        periodBudget: parseInt(String(el.periodBudget.value).replace(/[^0-9]/g, ''), 10) || 0,
        fixedCostTotal: parseInt(String(el.fixedCostTotal.value).replace(/[^0-9]/g, ''), 10) || 0,
      }),
    });
    el.settingsDialog.close();
    toast('設定を保存しました');
    await load();
  } catch (err) {
    el.settingsError.textContent = err.message;
    el.settingsError.hidden = false;
  }
});

document.querySelectorAll('[data-close]').forEach((b) => {
  b.addEventListener('click', () => b.closest('dialog').close());
});

el.fab.addEventListener('click', openEntry);

function showFatal(err) {
  if (err.unauthorized) return;
  el.app.innerHTML = `<p class="loading">読み込みに失敗しました: ${escapeHtml(err.message)}</p>`;
}

start().catch(showFatal);
