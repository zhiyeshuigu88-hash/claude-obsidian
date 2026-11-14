/**
 * 認証ユーティリティ（依存パッケージなし）。
 *
 * 要件定義書 v0.2 §7.7:
 *   - 個人利用のため新規登録は最初の1人だけ（以降は閉じる）
 *   - （v0.2 のたたき台はメール + パスワードだが、本人専用なので パスワードのみ に簡素化）
 *
 * パスワードが唯一の鍵になるため、ブルートフォース対策（LoginRateLimiter）が重要。
 *
 * パスワードは scrypt（Node 標準）でソルト付きハッシュ化する。
 * セッショントークンは乱数を発行し、サーバー側にはSHA-256ハッシュのみ保存する
 * （db.json が漏れてもそのままではセッションを乗っ取れない）。
 */

import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 8;
export const SESSION_COOKIE = 'kakei_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key) out[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function buildSessionCookie(token, { secure = false, maxAgeMs = SESSION_TTL_MS } = {}) {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie({ secure = false } = {}) {
  return buildSessionCookie('', { secure, maxAgeMs: 0 });
}

/**
 * ログイン試行のレート制限（ブルートフォース対策）。
 * キーごとに window 内の失敗が max 回に達したらロックする。成功でリセット。
 */
export class LoginRateLimiter {
  constructor({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.failures = new Map();
  }

  #fresh(key, now) {
    const list = (this.failures.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** ロック中なら再試行可能になるまでの秒数、そうでなければ 0 */
  retryAfterSeconds(key, now = Date.now()) {
    const list = this.#fresh(key, now);
    if (list.length < this.max) return 0;
    return Math.ceil((list[0] + this.windowMs - now) / 1000);
  }

  recordFailure(key, now = Date.now()) {
    const list = this.#fresh(key, now);
    list.push(now);
    this.failures.set(key, list);
  }

  reset(key) {
    this.failures.delete(key);
  }
}
