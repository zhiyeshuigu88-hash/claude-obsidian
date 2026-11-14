/**
 * 認証の HTTP 統合テスト。実サーバーを一時データファイル + 別ポートで起動して検証する。
 * （実データの data/db.json には一切触れない）
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 43000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;

let dir;
let server;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kakei-http-'));
  server = spawn(process.execPath, [join(HERE, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), KAKEI_DATA_FILE: join(dir, 'db.json') },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('http://localhost')) resolve();
    });
  });
});

after(async () => {
  server.kill();
  await rm(dir, { recursive: true, force: true });
});

const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('未ログインでは API が 401、静的ファイルは見られる', async () => {
  for (const path of ['/api/state', '/api/settings']) {
    assert.equal((await fetch(BASE + path)).status, 401);
  }
  assert.equal((await post('/api/expenses', { amount: 100, spentOn: '2026-09-01' })).status, 401);
  assert.equal((await fetch(BASE + '/')).status, 200);

  const status = await (await fetch(BASE + '/api/auth/status')).json();
  assert.deepEqual(status, { authenticated: false, needsSetup: true });
});

test('初期セットアップ → Cookie 発行 → ログイン状態で API が使える', async () => {
  const res = await post('/api/auth/setup', { password: 'correct-horse-battery' });
  assert.equal(res.status, 201);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = cookieOf(res);

  const state = await fetch(BASE + '/api/state', { headers: { cookie } });
  assert.equal(state.status, 200);
  assert.ok((await state.json()).period);

  const created = await post('/api/expenses', { amount: 1160, spentOn: '2026-09-01' }, { cookie });
  assert.equal(created.status, 201);
});

test('登録は最初の1人だけ。2回目のセットアップは 403', async () => {
  const res = await post('/api/auth/setup', { password: 'another-password' });
  assert.equal(res.status, 403);
  const status = await (await fetch(BASE + '/api/auth/status')).json();
  assert.equal(status.needsSetup, false);
});

test('ログイン成功 / 失敗、ログアウトでセッションが無効になる', async () => {
  const bad = await post('/api/auth/login', { password: 'wrong-password' });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get('set-cookie'), null);

  const ok = await post('/api/auth/login', { password: 'correct-horse-battery' });
  assert.equal(ok.status, 200);
  const cookie = cookieOf(ok);
  assert.equal((await fetch(BASE + '/api/state', { headers: { cookie } })).status, 200);

  const out = await post('/api/auth/logout', {}, { cookie });
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  // 旧トークンはサーバー側でも失効している
  assert.equal((await fetch(BASE + '/api/state', { headers: { cookie } })).status, 401);
});

test('偽造トークンは 401', async () => {
  const res = await fetch(BASE + '/api/state', { headers: { cookie: 'kakei_session=forged' } });
  assert.equal(res.status, 401);
});

test('別オリジンからの更新系リクエストは 403（CSRF 対策）', async () => {
  const ok = await post('/api/auth/login', { password: 'correct-horse-battery' });
  const cookie = cookieOf(ok);
  const res = await post(
    '/api/expenses',
    { amount: 999, spentOn: '2026-09-01' },
    { cookie, origin: 'https://evil.example' },
  );
  assert.equal(res.status, 403);
});

test('不正な期間ラベルは 500 ではなく 400', async () => {
  const ok = await post('/api/auth/login', { password: 'correct-horse-battery' });
  const cookie = cookieOf(ok);
  const res = await fetch(BASE + '/api/state?period=bogus', { headers: { cookie } });
  assert.equal(res.status, 400);
});

test('ログイン失敗が続くと 429 でロックされる（最後に実行）', async () => {
  let last;
  for (let i = 0; i < 6; i++) {
    last = await post('/api/auth/login', { password: `wrong-${i}` });
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
  // ロック中は正しいパスワードでも通らない
  const locked = await post('/api/auth/login', { password: 'correct-horse-battery' });
  assert.equal(locked.status, 429);
});
