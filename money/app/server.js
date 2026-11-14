/**
 * 家計管理アプリ フェーズ1 サーバー。
 * 依存パッケージなし（Node.js 標準モジュールのみ）。
 *
 * フェーズ1のスコープ（要件定義書 v0.2 §13 のフェーズ1 = 変動費入力 + 日間/期間合計 + ホーム画面）:
 *   - 変動費の手入力（金額・カテゴリ・日付・メモ・店名）
 *   - 日間合計 / 期間合計のプレビュー
 *   - ホーム画面（今日つかえる額 / 超過時は超過額）
 *   - 当日の支出の一覧・削除（入力ミスの訂正に必要な最小限）
 *   - 期間予算・固定費合計の手入力（ホームの計算に必須なため数値としてだけ保持）
 *   - ユーザー認証（メール + パスワード。登録は最初の1人だけ。§7.7）
 *
 * フェーズ2以降: 固定費マスタと自動計上、カテゴリ別予算、レシートOCR、分析グラフ。
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { todayInTokyo } from './lib/civil-date.js';
import {
  getPeriod,
  getPeriodByLabel,
  getRemainingDays,
  getElapsedDays,
  getNextPeriod,
  getPreviousPeriod,
} from './lib/period.js';
import { calculateAllowance } from './lib/allowance.js';
import {
  LoginRateLimiter,
  SESSION_COOKIE,
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
} from './lib/auth.js';
import {
  ForbiddenError,
  ValidationError,
  createExpense,
  createFirstUser,
  createSession,
  deleteExpense,
  deleteSession,
  getCategories,
  getExpensesInRange,
  getSettings,
  getUserBySession,
  hasUsers,
  updateSettings,
  verifyLogin,
} from './lib/store.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, 'public');
const PORT = Number(process.env.PORT) || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new ValidationError('リクエストボディが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('JSON の解析に失敗しました'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * ホーム画面が必要とする状態を1レスポンスにまとめる。
 * §3 の設計上の含意「起動直後に残額が見える」を1往復で満たすため。
 */
async function buildState(userId, periodLabelParam) {
  const [categories, settings] = await Promise.all([getCategories(userId), getSettings(userId)]);
  const startDay = settings.periodStartDay;

  const today = todayInTokyo();
  const currentPeriod = getPeriod(today, startDay);

  const period = periodLabelParam
    ? getPeriodByLabel(periodLabelParam, startDay)
    : currentPeriod;

  const isCurrent = period.label === currentPeriod.label;

  const expenses = await getExpensesInRange(userId, period.startsOn, period.endsOn);
  const variableSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const todaysExpenses = isCurrent ? expenses.filter((e) => e.spentOn === today) : [];
  const todayTotal = todaysExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 残日数: 当期間は今日基準、過去/未来の期間は日割りの意味がないので最終日基準(=1)。
  const remainingDays = isCurrent ? getRemainingDays(today, startDay) : 1;
  const elapsedDays = isCurrent ? getElapsedDays(today, startDay) : period.lengthInDays;

  const allowance = calculateAllowance({
    periodBudget: settings.periodBudget,
    fixedCostTotal: settings.fixedCostTotal,
    variableSpent,
    remainingDays,
  });

  // カテゴリ別内訳（グラフはフェーズ2だが、数値の内訳自体は期間合計プレビューの一部）
  const byCategory = {};
  for (const e of expenses) {
    const key = e.categoryId || '__none__';
    byCategory[key] = (byCategory[key] || 0) + e.amount;
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([id, amount]) => ({
      categoryId: id === '__none__' ? null : id,
      name: id === '__none__' ? '未分類' : categories.find((c) => c.id === id)?.name || '不明',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    today,
    period,
    isCurrent,
    prevPeriodLabel: getPreviousPeriod(period, startDay).label,
    nextPeriodLabel: getNextPeriod(period, startDay).label,
    hasNextPeriod: getNextPeriod(period, startDay).startsOn <= currentPeriod.startsOn,
    remainingDays,
    elapsedDays,
    settings,
    categories,
    allowance,
    period_totals: {
      variableSpent,
      fixedCostTotal: settings.fixedCostTotal,
      total: variableSpent + settings.fixedCostTotal,
    },
    today_total: todayTotal,
    todays_expenses: todaysExpenses,
    period_expenses: expenses,
    category_breakdown: categoryBreakdown,
  };
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  const data = await readFile(filePath);
  res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
  res.end(data);
}

const loginLimiter = new LoginRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

/** HTTPS 配下（リバースプロキシ含む）なら Cookie に Secure を付ける。 */
function isSecureRequest(req) {
  return req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1';
}

/**
 * CSRF 対策の多重化:
 *   1. Cookie は SameSite=Strict（クロスサイトからは送られない）
 *   2. 状態を変える API は Origin ヘッダがあれば Host と一致を要求
 */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // 同一オリジンの GET や非ブラウザクライアント
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function sessionTokenOf(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

function startSession(req, res, token, user, status = 200) {
  const payload = JSON.stringify({ authenticated: true });
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'set-cookie': buildSessionCookie(token, { secure: isSecureRequest(req) }),
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  const isMutation = req.method !== 'GET' && req.method !== 'HEAD';

  try {
    if (pathname.startsWith('/api/') && isMutation && !isSameOrigin(req)) {
      return sendJson(res, 403, { error: '不正なリクエスト元です' });
    }

    /* ---------- 認証（ログイン不要） ---------- */

    if (pathname === '/api/auth/status' && req.method === 'GET') {
      const user = await getUserBySession(sessionTokenOf(req));
      return sendJson(res, 200, {
        authenticated: Boolean(user),
        // 登録は最初の1人だけ。ユーザーがいなければ初期セットアップ画面を出す。
        needsSetup: !(await hasUsers()),
      });
    }

    if (pathname === '/api/auth/setup' && req.method === 'POST') {
      const body = await readBody(req);
      const user = await createFirstUser(body.password);
      const token = await createSession(user.id);
      return startSession(req, res, token, user, 201);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      const wait = loginLimiter.retryAfterSeconds(ip);
      if (wait > 0) {
        res.setHeader('retry-after', String(wait));
        return sendJson(res, 429, {
          error: `ログインの失敗が続いたため、${Math.ceil(wait / 60)}分ほど待ってからやり直してください`,
        });
      }
      const body = await readBody(req);
      const user = await verifyLogin(body.password);
      if (!user) {
        loginLimiter.recordFailure(ip);
        return sendJson(res, 401, { error: 'パスワードが違います' });
      }
      loginLimiter.reset(ip);
      const token = await createSession(user.id);
      return startSession(req, res, token, user);
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      await deleteSession(sessionTokenOf(req));
      res.setHeader('set-cookie', clearSessionCookie({ secure: isSecureRequest(req) }));
      return sendJson(res, 200, { authenticated: false });
    }

    /* ---------- ここから先はログイン必須 ---------- */

    if (pathname.startsWith('/api/')) {
      const user = await getUserBySession(sessionTokenOf(req));
      if (!user) return sendJson(res, 401, { error: 'ログインが必要です' });
      const userId = user.id;

      if (pathname === '/api/state' && req.method === 'GET') {
        const state = await buildState(userId, url.searchParams.get('period'));
        return sendJson(res, 200, state);
      }

      if (pathname === '/api/expenses' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 201, await createExpense(userId, body));
      }

      if (pathname.startsWith('/api/expenses/') && req.method === 'DELETE') {
        const id = decodeURIComponent(pathname.slice('/api/expenses/'.length));
        return sendJson(res, 200, await deleteExpense(userId, id));
      }

      if (pathname === '/api/settings' && req.method === 'GET') {
        return sendJson(res, 200, await getSettings(userId));
      }

      if (pathname === '/api/settings' && req.method === 'PUT') {
        const body = await readBody(req);
        return sendJson(res, 200, await updateSettings(userId, body));
      }

      return sendJson(res, 404, { error: 'not found' });
    }

    // 静的ファイル（ログイン画面そのものを返す必要があるため公開。データは含まない）
    return await serveStatic(req, res, pathname);
  } catch (err) {
    if (err instanceof ValidationError) {
      return sendJson(res, 400, { error: err.message });
    }
    if (err instanceof ForbiddenError) {
      return sendJson(res, 403, { error: err.message });
    }
    // 期間ラベルなど、クエリの形式不正
    if (err instanceof TypeError || err instanceof RangeError) {
      if (pathname === '/api/state') return sendJson(res, 400, { error: '期間の指定が正しくありません' });
    }
    console.error(err);
    return sendJson(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`家計管理アプリ (フェーズ1) → http://localhost:${PORT}`);
});
