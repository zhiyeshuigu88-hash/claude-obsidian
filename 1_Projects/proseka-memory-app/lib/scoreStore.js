const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'score-memory', 'records.json');
const PHOTO_DIR = path.join(__dirname, '..', 'score-memory', 'photos');

const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER', 'APPEND'];
const RANKS = ['C', 'B', 'A', 'S'];

// --- ファイル I/O ---

function ensureFile() {
  if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(records) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

// --- FC / AP 自動判定(要件3.5。判定基準はここに集約し差し替え可能にする) ---

function computeIsAllPerfect(j) {
  return j.great === 0 && j.good === 0 && j.bad === 0 && j.miss === 0 && j.perfect > 0;
}

function computeIsFullCombo(j) {
  return j.miss === 0;
}

// --- バリデーション / 正規化 ---

function toNonNegInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 入力を検証し、正規化済みフィールドを返す。エラー時は { error } を返す。
function normalizeInput(input, { partial = false } = {}) {
  const out = {};

  if (input.songTitle !== undefined) {
    const title = String(input.songTitle || '').trim();
    if (!title) return { error: 'songTitle is required' };
    out.songTitle = title;
  } else if (!partial) {
    return { error: 'songTitle is required' };
  }

  if (input.difficulty !== undefined) {
    if (!DIFFICULTIES.includes(input.difficulty)) return { error: 'invalid difficulty' };
    out.difficulty = input.difficulty;
  } else if (!partial) {
    return { error: 'difficulty is required' };
  }

  if (input.rank !== undefined) {
    if (!RANKS.includes(input.rank)) return { error: 'invalid rank' };
    out.rank = input.rank;
  } else if (!partial) {
    return { error: 'rank is required' };
  }

  for (const key of ['score', 'maxCombo']) {
    if (input[key] !== undefined) {
      const v = toNonNegInt(input[key]);
      if (v === null) return { error: `${key} must be a non-negative integer` };
      out[key] = v;
    } else if (!partial) {
      return { error: `${key} is required` };
    }
  }

  if (input.judgments !== undefined) {
    const src = input.judgments || {};
    const j = {};
    for (const key of ['perfect', 'great', 'good', 'bad', 'miss']) {
      const v = toNonNegInt(src[key]);
      if (v === null) return { error: `judgments.${key} must be a non-negative integer` };
      j[key] = v;
    }
    out.judgments = j;
  } else if (!partial) {
    return { error: 'judgments is required' };
  }

  if (input.playedAt !== undefined) {
    const d = String(input.playedAt || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'playedAt must be YYYY-MM-DD' };
    out.playedAt = d;
  } else if (!partial) {
    out.playedAt = localTodayDate();
  }

  // FC/AP: 明示指定があれば優先、なければ判定数から自動計算(judgmentsが確定している場合)
  const judgmentsForFlags = out.judgments;
  if (judgmentsForFlags) {
    out.isAllPerfect =
      typeof input.isAllPerfect === 'boolean'
        ? input.isAllPerfect
        : computeIsAllPerfect(judgmentsForFlags);
    out.isFullCombo =
      typeof input.isFullCombo === 'boolean'
        ? input.isFullCombo
        : computeIsFullCombo(judgmentsForFlags);
  } else {
    if (typeof input.isAllPerfect === 'boolean') out.isAllPerfect = input.isAllPerfect;
    if (typeof input.isFullCombo === 'boolean') out.isFullCombo = input.isFullCombo;
  }

  return { value: out };
}

// --- CRUD ---

function listRecords() {
  return readAll();
}

function getRecord(id) {
  return readAll().find((r) => r.id === id) || null;
}

function createRecord(input) {
  const norm = normalizeInput(input, { partial: false });
  if (norm.error) return { error: norm.error };

  const records = readAll();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const record = {
    id,
    ...norm.value,
    photoPath: null,
    createdAt: now,
    updatedAt: now,
  };
  records.unshift(record);
  writeAll(records);
  return { value: record };
}

function updateRecord(id, input) {
  const records = readAll();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return { error: 'not found' };

  const norm = normalizeInput(input, { partial: true });
  if (norm.error) return { error: norm.error };

  const merged = { ...records[idx], ...norm.value };

  // judgments が更新され、FC/AP の明示指定が無い場合は再計算する
  if (input.judgments !== undefined) {
    if (typeof input.isAllPerfect !== 'boolean') merged.isAllPerfect = computeIsAllPerfect(merged.judgments);
    if (typeof input.isFullCombo !== 'boolean') merged.isFullCombo = computeIsFullCombo(merged.judgments);
  }

  merged.updatedAt = new Date().toISOString();
  records[idx] = merged;
  writeAll(records);
  return { value: merged };
}

function deleteRecord(id) {
  const records = readAll();
  const record = records.find((r) => r.id === id);
  if (!record) return { error: 'not found' };

  // 写真ファイルも削除する
  if (record.photoPath) {
    const filename = path.basename(record.photoPath);
    const filePath = path.join(PHOTO_DIR, filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      // 写真削除失敗はレコード削除を妨げない
    }
  }

  writeAll(records.filter((r) => r.id !== id));
  return { value: { ok: true } };
}

// 写真を紐付け(server.js が multer 保存後に呼ぶ)。古い写真があれば削除する。
function setPhoto(id, filename) {
  const records = readAll();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return { error: 'not found' };

  const old = records[idx].photoPath;
  if (old && path.basename(old) !== filename) {
    const oldPath = path.join(PHOTO_DIR, path.basename(old));
    try {
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (e) {
      /* ignore */
    }
  }

  records[idx].photoPath = filename ? `photos/${filename}` : null;
  records[idx].updatedAt = new Date().toISOString();
  writeAll(records);
  return { value: records[idx] };
}

module.exports = {
  DIFFICULTIES,
  RANKS,
  PHOTO_DIR,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  setPhoto,
  computeIsAllPerfect,
  computeIsFullCombo,
  localTodayDate,
};
