const express = require('express');
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

if (require.main === module) {
  app.listen(PORT, () => console.log(`Folio 起動中: http://localhost:${PORT}`));
} else {
  module.exports = app;
}
