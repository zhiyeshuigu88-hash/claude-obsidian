/**
 * フェーズ1のテスト。node:test（標準）で実行: `npm test`
 * 期間計算そのものの網羅テストはフェーズ0（money/period.test.ts, 88件）にある。
 * ここではフェーズ1で足した「集計 + 今日つかえる額」の結線と、ユーザー認証を確認する。
 */

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, mkdtemp, writeFile } from 'node:fs/promises';

// store.js は import 時に KAKEI_DATA_FILE を読むため、動的 import の前に設定する。
const dir = await mkdtemp(join(tmpdir(), 'kakei-'));
const DATA_FILE = join(dir, 'db.json');
process.env.KAKEI_DATA_FILE = DATA_FILE;

const store = await import('../lib/store.js');
const auth = await import('../lib/auth.js');
const { getPeriod, getRemainingDays } = await import('../lib/period.js');
const { calculateAllowance } = await import('../lib/allowance.js');

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(DATA_FILE, { force: true });
  store._resetCache();
});

const PASSWORD = 'correct-horse-battery';
const newUser = () => store.createFirstUser(PASSWORD);

/* ------------------------------ 家計ロジック ------------------------------ */

test('初期カテゴリは要件定義書 §12 の8種', async () => {
  const user = await newUser();
  const cats = await store.getCategories(user.id);
  assert.deepEqual(
    cats.map((c) => c.name),
    ['食費', '日用品', '交通', '交際', '趣味', '衣服', '医療', 'その他'],
  );
});

test('変動費を登録し、期間内で合計できる', async () => {
  const user = await newUser();
  const cats = await store.getCategories(user.id);
  await store.createExpense(user.id, { amount: 1200, categoryId: cats[0].id, spentOn: '2026-09-01' });
  await store.createExpense(user.id, { amount: 800, categoryId: null, spentOn: '2026-09-10', memo: '昼食' });
  // 期間外（前期）
  await store.createExpense(user.id, { amount: 5000, spentOn: '2026-08-20' });

  const period = getPeriod('2026-09-05'); // 8月分: 2026-08-27 〜 2026-09-26
  const rows = await store.getExpensesInRange(user.id, period.startsOn, period.endsOn);
  assert.equal(rows.reduce((s, e) => s + e.amount, 0), 2000);
});

test('金額0以下は登録できない', async () => {
  const user = await newUser();
  await assert.rejects(() => store.createExpense(user.id, { amount: 0, spentOn: '2026-09-01' }), store.ValidationError);
  await assert.rejects(() => store.createExpense(user.id, { amount: -5, spentOn: '2026-09-01' }), store.ValidationError);
});

test('削除できる', async () => {
  const user = await newUser();
  const e = await store.createExpense(user.id, { amount: 300, spentOn: '2026-09-01' });
  await store.deleteExpense(user.id, e.id);
  assert.equal((await store.getExpensesInRange(user.id, '2026-01-01', '2026-12-31')).length, 0);
});

test('今日つかえる額: 固定費を除いた変動費予算を残日数で割る', () => {
  const remainingDays = getRemainingDays('2026-09-09'); // 8月分の残り18日
  assert.equal(remainingDays, 18);
  const a = calculateAllowance({
    periodBudget: 200_000,
    fixedCostTotal: 98_000,
    variableSpent: 42_800,
    remainingDays,
  });
  assert.equal(a.status, 'within');
  assert.equal(a.variableBudget, 102_000);
  assert.equal(a.remaining, 59_200);
  assert.equal(a.dailyAllowance, 3_288); // 59200 / 18 切り捨て
});

test('超過時は日割りせず超過額をそのまま返す', () => {
  const a = calculateAllowance({
    periodBudget: 100_000,
    fixedCostTotal: 98_000,
    variableSpent: 5_120,
    remainingDays: 6,
  });
  assert.equal(a.status, 'over');
  assert.equal(a.dailyAllowance, null);
  assert.equal(a.overspent, 3_120);
});

test('設定の負値は拒否する', async () => {
  const user = await newUser();
  await assert.rejects(() => store.updateSettings(user.id, { periodBudget: -1 }), store.ValidationError);
});

/* -------------------------------- 認証 -------------------------------- */

test('パスワードはハッシュ保存され、平文は db.json に残らない', async () => {
  await newUser();
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(DATA_FILE, 'utf8');
  assert.ok(!raw.includes(PASSWORD));
  assert.match(raw, /scrypt\$/);
});

test('正しいパスワードでログインでき、誤りは拒否される', async () => {
  const user = await newUser();
  assert.equal((await store.verifyLogin(PASSWORD)).id, user.id);
  assert.equal(await store.verifyLogin('wrong-password'), null);
  assert.equal(await store.verifyLogin(''), null);
  assert.equal(await store.verifyLogin(undefined), null);
});

test('ユーザーがいない状態では誰もログインできない', async () => {
  assert.equal(await store.verifyLogin(PASSWORD), null);
});

test('新規登録は最初の1人だけ（2人目は拒否）', async () => {
  await newUser();
  assert.equal(await store.hasUsers(), true);
  await assert.rejects(() => store.createFirstUser('another-password'), store.ForbiddenError);
});

test('登録時のパスワード長を検証する', async () => {
  await assert.rejects(() => store.createFirstUser('short'), store.ValidationError);
  await assert.rejects(() => store.createFirstUser(undefined), store.ValidationError);
  assert.equal(await store.hasUsers(), false);
});

test('セッション: 発行・取得・破棄・期限切れ', async () => {
  const user = await newUser();
  const token = await store.createSession(user.id);

  assert.equal((await store.getUserBySession(token)).id, user.id);
  assert.equal(await store.getUserBySession('forged-token'), null);
  assert.equal(await store.getUserBySession(null), null);

  // db.json にはトークンそのものではなくハッシュだけが保存される
  const { readFile } = await import('node:fs/promises');
  assert.ok(!(await readFile(DATA_FILE, 'utf8')).includes(token));

  await store.deleteSession(token);
  assert.equal(await store.getUserBySession(token), null);
});

test('期限切れセッションは無効', async () => {
  const user = await newUser();
  const token = await store.createSession(user.id);

  // 期限を過去に書き換える
  const { readFile } = await import('node:fs/promises');
  const db = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  db.sessions[0].expiresAt = Date.now() - 1000;
  await writeFile(DATA_FILE, JSON.stringify(db));
  store._resetCache();

  assert.equal(await store.getUserBySession(token), null);
});

test('他ユーザーの支出は削除できない（データ分離）', async () => {
  const mine = await newUser();
  const e = await store.createExpense(mine.id, { amount: 500, spentOn: '2026-09-01' });
  await assert.rejects(() => store.deleteExpense('another-user-id', e.id), store.ValidationError);
  assert.equal((await store.getExpensesInRange(mine.id, '2026-09-01', '2026-09-01')).length, 1);
  // 他ユーザーからは見えない
  assert.equal((await store.getExpensesInRange('another-user-id', '2026-09-01', '2026-09-01')).length, 0);
});

test('認証導入前の旧形式データは最初のアカウントに引き継がれる', async () => {
  await writeFile(DATA_FILE, JSON.stringify({
    categories: [{ id: 'c1', name: '食費', color: '#e8590c', sortOrder: 0 }],
    expenses: [{ id: 'e1', amount: 700, categoryId: 'c1', spentOn: '2026-09-01', type: 'variable', createdAt: '2026-09-01T00:00:00.000Z' }],
    settings: { periodBudget: 150_000, fixedCostTotal: 50_000, periodStartDay: 27 },
  }));
  store._resetCache();

  assert.equal(await store.hasUsers(), false);
  const user = await newUser();
  const rows = await store.getExpensesInRange(user.id, '2026-09-01', '2026-09-01');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 700);
  assert.equal((await store.getSettings(user.id)).periodBudget, 150_000);
  assert.equal((await store.getCategories(user.id))[0].name, '食費');
});

test('ログイン試行のレート制限: 5回失敗でロック、成功でリセット', () => {
  const limiter = new auth.LoginRateLimiter({ max: 5, windowMs: 60_000 });
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) limiter.recordFailure('ip', t0 + i);
  assert.equal(limiter.retryAfterSeconds('ip', t0 + 10), 0);
  limiter.recordFailure('ip', t0 + 5);
  assert.ok(limiter.retryAfterSeconds('ip', t0 + 10) > 0);
  assert.equal(limiter.retryAfterSeconds('other-ip', t0 + 10), 0); // 他IPは影響なし
  assert.equal(limiter.retryAfterSeconds('ip', t0 + 61_000), 0); // 窓を過ぎれば解除
  limiter.reset('ip');
  assert.equal(limiter.retryAfterSeconds('ip', t0 + 10), 0);
});

test('Cookie: HttpOnly / SameSite=Strict が付く', () => {
  const cookie = auth.buildSessionCookie('tok', { secure: true });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.equal(auth.parseCookies('a=1; kakei_session=tok%20x').kakei_session, 'tok x');
});
