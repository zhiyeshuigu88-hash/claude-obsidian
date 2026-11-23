const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('./lib/markdownStore');
const diaryStore = require('./lib/diaryStore');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOARD_FILE = path.join(__dirname, '..', 'claude', '掲示板.md');
const IDEA_FILE = path.join(__dirname, '..', 'claude', 'アイディアメモ.md');
const DIARY_FILE = path.join(__dirname, '..', 'claude', 'Diary.md');
const ATTACH_DIR = path.join(__dirname, '..', 'claude', 'attachments');
const DIARY_TITLE = '日記';
const DIARY_DESCRIPTION = 'その日にあったこと、考えたことを日付ごとに書き留める場所。';

store.ensureFile(
  IDEA_FILE,
  'アイディア・気付きメモ',
  'ふと思いついたアイデアや、気付いたことを日付ごとに書き留める場所。'
);

app.get('/api/board', (req, res) => {
  res.json(store.listEntries(BOARD_FILE));
});

app.post('/api/board', (req, res) => {
  res.json(store.addEntry(BOARD_FILE, req.body.content));
});

app.delete('/api/board/:id', (req, res) => {
  store.deleteEntry(BOARD_FILE, req.params.id);
  res.json({ ok: true });
});

app.get('/api/ideas', (req, res) => {
  res.json(store.listEntries(IDEA_FILE));
});

app.post('/api/ideas', (req, res) => {
  res.json(store.addEntry(IDEA_FILE, req.body.content));
});

app.delete('/api/ideas/:id', (req, res) => {
  store.deleteEntry(IDEA_FILE, req.params.id);
  res.json({ ok: true });
});

app.get('/api/diary', (req, res) => {
  res.json(diaryStore.listDiaryEntries(DIARY_FILE));
});

app.get('/api/diary/:date', (req, res) => {
  if (!diaryStore.isValidDate(req.params.date)) {
    return res.status(400).json({ error: 'invalid date' });
  }
  res.json({ date: req.params.date, content: diaryStore.readDiary(DIARY_FILE, req.params.date) });
});

app.put('/api/diary/:date', (req, res) => {
  if (!diaryStore.isValidDate(req.params.date)) {
    return res.status(400).json({ error: 'invalid date' });
  }
  diaryStore.saveDiary(DIARY_FILE, DIARY_TITLE, DIARY_DESCRIPTION, req.params.date, req.body.content || '');
  res.json({ date: req.params.date, content: req.body.content || '' });
});

// --- 手書き画像（日記に埋め込む PNG）---

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ATTACH_NAME_RE = /^handwriting-\d{8}-\d{6}(-\d+)?\.png$/;

function attachmentStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

app.use('/attachments', express.static(ATTACH_DIR));

app.post('/api/attachments', express.raw({ type: 'image/png', limit: '15mb' }), (req, res) => {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length < PNG_SIGNATURE.length || !body.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return res.status(400).json({ error: 'PNG image required' });
  }
  fs.mkdirSync(ATTACH_DIR, { recursive: true });
  const base = `handwriting-${attachmentStamp()}`;
  let name = `${base}.png`;
  for (let i = 1; fs.existsSync(path.join(ATTACH_DIR, name)); i++) name = `${base}-${i}.png`;
  fs.writeFileSync(path.join(ATTACH_DIR, name), body);
  res.status(201).json({ name });
});

app.delete('/api/attachments/:name', (req, res) => {
  if (!ATTACH_NAME_RE.test(req.params.name)) return res.status(400).json({ error: 'invalid name' });
  const file = path.join(ATTACH_DIR, req.params.name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Folio 起動中: http://localhost:${PORT}`));
} else {
  module.exports = app;
}
