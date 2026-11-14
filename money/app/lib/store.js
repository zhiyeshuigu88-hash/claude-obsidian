/**
 * JSON ファイルによる永続化。フェーズ1は個人ローカル利用のため DB を持たない。
 * （要件定義書 v0.2 §11 では Supabase を想定しているが、フェーズ1では単一ファイルに閉じる）
 *
 * データモデルは要件定義書 §9 の部分実装:
 *   - users      : メール + パスワードハッシュ（登録は最初の1人だけ。§7.7）
 *   - sessions   : セッショントークンのハッシュ + 有効期限
 *   - categories : ユーザーごとの初期カテゴリ（§12 未決事項5 の提案セット）
 *   - expenses   : 変動費のみ（type は常に 'variable'）
 *   - settings   : ユーザーごとの period_budget / fixed_cost_total / period_start_day
 *
 * すべてのデータアクセス関数は userId を第一引数に取り、他ユーザーの行は見えない
 * （§8 の「行レベルセキュリティによる他人データの遮断」をアプリ層で担保する）。
 * 固定費マスタ・自動計上・カテゴリ別予算はフェーズ2以降。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import {
  MIN_PASSWORD_LENGTH,
  SESSION_TTL_MS,
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
} from './auth.js';

export class ValidationError extends Error {}
export class ForbiddenError extends Error {}

const HERE = dirname(fileURLToPath(import.meta.url));
// テストでは KAKEI_DATA_FILE で退避先を差し替える。
const DATA_FILE = process.env.KAKEI_DATA_FILE || join(HERE, '..', 'data', 'db.json');
const DATA_DIR = dirname(DATA_FILE);

/** §12 未決事項5 の提案セット。フェーズ1の初期カテゴリ。 */
const DEFAULT_CATEGORIES = [
  { name: '食費', color: '#e8590c' },
  { name: '日用品', color: '#2f9e44' },
  { name: '交通', color: '#1971c2' },
  { name: '交際', color: '#9c36b5' },
  { name: '趣味', color: '#e03131' },
  { name: '衣服', color: '#0c8599' },
  { name: '医療', color: '#495057' },
  { name: 'その他', color: '#868e96' },
];

const DEFAULT_SETTINGS = {
  // §5.2 でフェーズ2扱いだが、ホーム画面の「今日つかえる額」に予算が要るため
  // フェーズ1では単一の数値としてだけ保持する（固定費マスタは持たない）。
  periodBudget: 0,
  fixedCostTotal: 0,
  periodStartDay: 27,
};

function seedCategories(userId) {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: randomUUID(),
    userId,
    name: c.name,
    color: c.color,
    sortOrder: i,
  }));
}

function emptyDb() {
  return {
    users: [],
    sessions: [],
    categories: [],
    expenses: [],
    settings: {}, // userId -> settings
    // 認証導入前（ユーザー概念なし）のデータ。最初のアカウント作成時に引き継ぐ。
    legacy: null,
  };
}

let cache = null;
let writeQueue = Promise.resolve();

async function load() {
  if (cache) return cache;
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });

  if (existsSync(DATA_FILE)) {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    if (parsed.users) {
      cache = { ...emptyDb(), ...parsed };
    } else {
      // 旧形式（フェーズ1初期・認証なし）からの移行
      cache = emptyDb();
      cache.legacy = {
        categories: parsed.categories || [],
        expenses: parsed.expenses || [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
      await persist();
    }
  } else {
    cache = emptyDb();
    await persist();
  }
  return cache;
}

async function persist() {
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue.then(() => writeFile(DATA_FILE, snapshot, 'utf8'));
  return writeQueue;
}

/* ------------------------------ 認証 ------------------------------ */

export async function hasUsers() {
  const db = await load();
  return db.users.length > 0;
}

function publicUser(user) {
  return { id: user.id };
}

/**
 * 最初のアカウントを作る。個人利用のためユーザーが1人でもいれば登録は閉じる（§7.7）。
 * 認証導入前のデータがあれば、そのユーザーに引き継ぐ。
 */
export async function createFirstUser(password) {
  const db = await load();
  if (db.users.length > 0) {
    throw new ForbiddenError('新規登録は受け付けていません');
  }

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`);
  }

  const user = {
    id: randomUUID(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  // 非同期のハッシュ計算中に別リクエストが先に登録していないか再確認
  if (db.users.length > 0) throw new ForbiddenError('新規登録は受け付けていません');
  db.users.push(user);

  if (db.legacy) {
    db.categories.push(...db.legacy.categories.map((c) => ({ ...c, userId: user.id })));
    db.expenses.push(...db.legacy.expenses.map((e) => ({ ...e, userId: user.id })));
    db.settings[user.id] = db.legacy.settings;
    db.legacy = null;
  } else {
    db.categories.push(...seedCategories(user.id));
    db.settings[user.id] = { ...DEFAULT_SETTINGS };
  }

  await persist();
  return publicUser(user);
}

// 存在しないメールでも同程度の時間をかけ、メールの存在有無を応答時間から推測させない。
const DUMMY_HASH_PROMISE = hashPassword('dummy-password-for-timing');

/**
 * パスワードだけで認証する。利用者は1人だけ（登録は最初の1人で閉じる）なので
 * users[0] と照合する。メール付きで作られた旧アカウントもそのまま使える。
 */
export async function verifyLogin(password) {
  const db = await load();
  const user = db.users[0];
  const stored = user ? user.passwordHash : await DUMMY_HASH_PROMISE;
  const ok = await verifyPassword(String(password ?? ''), stored);
  return ok && user ? publicUser(user) : null;
}

export async function createSession(userId) {
  const db = await load();
  const now = Date.now();
  // 期限切れを掃除
  db.sessions = db.sessions.filter((s) => s.expiresAt > now);

  const token = newSessionToken();
  db.sessions.push({
    tokenHash: hashToken(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  });
  await persist();
  return token;
}

export async function getUserBySession(token) {
  if (!token) return null;
  const db = await load();
  const tokenHash = hashToken(token);
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || session.expiresAt <= Date.now()) return null;
  const user = db.users.find((u) => u.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function deleteSession(token) {
  if (!token) return;
  const db = await load();
  const tokenHash = hashToken(token);
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
  if (db.sessions.length !== before) await persist();
}

/* ------------------------- ユーザーごとのデータ ------------------------- */

export async function getCategories(userId) {
  const db = await load();
  return db.categories
    .filter((c) => c.userId === userId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getSettings(userId) {
  const db = await load();
  return db.settings[userId] || { ...DEFAULT_SETTINGS };
}

export async function updateSettings(userId, patch) {
  const db = await load();
  const next = { ...(db.settings[userId] || DEFAULT_SETTINGS) };
  for (const key of ['periodBudget', 'fixedCostTotal']) {
    if (patch[key] != null) {
      const value = Number(patch[key]);
      if (!Number.isFinite(value) || value < 0) {
        throw new ValidationError(`${key} は0以上の数値である必要があります`);
      }
      next[key] = Math.round(value);
    }
  }
  db.settings[userId] = next;
  await persist();
  return next;
}

/** 期間 [startsOn, endsOn]（両端含む）の変動費を新しい順で返す。 */
export async function getExpensesInRange(userId, startsOn, endsOn) {
  const db = await load();
  return db.expenses
    .filter((e) => e.userId === userId && e.spentOn >= startsOn && e.spentOn <= endsOn)
    .sort((a, b) => (a.spentOn === b.spentOn
      ? b.createdAt.localeCompare(a.createdAt)
      : b.spentOn.localeCompare(a.spentOn)));
}

export async function createExpense(userId, { amount, categoryId, spentOn, storeName, memo }) {
  const db = await load();

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError('金額は正の数値である必要があります');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
    throw new ValidationError('日付は YYYY-MM-DD 形式である必要があります');
  }
  let category = null;
  if (categoryId) {
    category = db.categories.find((c) => c.id === categoryId && c.userId === userId) || null;
    if (!category) throw new ValidationError('存在しないカテゴリです');
  }

  const expense = {
    id: randomUUID(),
    userId,
    amount: Math.round(value),
    categoryId: category ? category.id : null,
    spentOn,
    type: 'variable',
    storeName: (storeName || '').trim() || null,
    memo: (memo || '').trim() || null,
    createdAt: new Date().toISOString(),
  };
  db.expenses.push(expense);
  await persist();
  return expense;
}

export async function deleteExpense(userId, id) {
  const db = await load();
  // 他ユーザーの支出は「存在しない」と同じ扱いにする
  const index = db.expenses.findIndex((e) => e.id === id && e.userId === userId);
  if (index === -1) throw new ValidationError('存在しない支出です');
  const [removed] = db.expenses.splice(index, 1);
  await persist();
  return removed;
}

/** テスト用: キャッシュを破棄する */
export function _resetCache() {
  cache = null;
}
