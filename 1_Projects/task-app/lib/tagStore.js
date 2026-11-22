// あらかじめ作っておくタグの一覧。タスクに付けるタグはここから選ぶ。
// タスク側（tasks.json の tags）には文字列がそのまま入るので、一覧から消してもタスクのタグは消えない。
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tags.json');
const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

const MAX_LENGTH = 20;

// 先頭の # と前後の空白・句読点（「仕事.」のような表記ゆれ）を落とす
function normalizeTag(input) {
  return String(input ?? '')
    .trim()
    .replace(/^#+/, '')
    .replace(/[\s.。、,，]+$/, '')
    .trim();
}

// 初回だけ、いまタスクに付いているタグを一覧の初期値にする
function seedFromTasks() {
  try {
    const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    const seen = new Set();
    const tags = [];
    for (const t of tasks) {
      for (const raw of t.tags || []) {
        const tag = normalizeTag(raw);
        if (tag && tag.length <= MAX_LENGTH && !seen.has(tag)) {
          seen.add(tag);
          tags.push(tag);
        }
      }
    }
    return tags;
  } catch {
    return [];
  }
}

function readAll() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = seedFromTasks();
    writeAll(seeded);
    return seeded;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(tags) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(tags, null, 2), 'utf-8');
}

function listTags() {
  return readAll();
}

// 追加したタグ名を返す。不正・重複のときは Error（message はそのまま画面に出せる日本語）
function addTag(input) {
  const tag = normalizeTag(input);
  if (!tag) throw new Error('タグ名を入力してください');
  if (tag.length > MAX_LENGTH) throw new Error(`タグ名は${MAX_LENGTH}文字までです`);
  if (/[,，]/.test(tag)) throw new Error('タグ名にカンマは使えません');
  const tags = readAll();
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) throw new Error('同じ名前のタグがすでにあります');
  tags.push(tag);
  writeAll(tags);
  return tag;
}

// 一覧から外す。見つからなければ false
function removeTag(input) {
  const tags = readAll();
  const next = tags.filter((t) => t !== input);
  if (next.length === tags.length) return false;
  writeAll(next);
  return true;
}

module.exports = { listTags, addTag, removeTag, normalizeTag };
