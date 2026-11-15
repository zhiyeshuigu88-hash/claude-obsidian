const express = require('express');
const path = require('path');
const multer = require('multer');
const scoreStore = require('./lib/scoreStore');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 写真配信(要件: GET /photos/:filename)
app.use('/photos', express.static(scoreStore.PHOTO_DIR));

// --- 写真アップロード(multer) ---
// 先に一時ファイル名で受け取り、レコードIDに紐付けてリネームする
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, scoreStore.PHOTO_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `tmp_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const fs = require('fs');

// multipart のテキストフィールドをレコード入力オブジェクトへ変換
function parseBody(body) {
  const input = {};
  if (body.songTitle !== undefined) input.songTitle = body.songTitle;
  if (body.difficulty !== undefined) input.difficulty = body.difficulty;
  if (body.rank !== undefined) input.rank = body.rank;
  if (body.score !== undefined) input.score = body.score;
  if (body.maxCombo !== undefined) input.maxCombo = body.maxCombo;
  if (body.playedAt !== undefined) input.playedAt = body.playedAt;

  const j = {};
  let hasJ = false;
  for (const key of ['perfect', 'great', 'good', 'bad', 'miss']) {
    if (body[key] !== undefined) {
      j[key] = body[key];
      hasJ = true;
    }
  }
  if (hasJ) input.judgments = j;

  if (body.isFullCombo !== undefined) input.isFullCombo = body.isFullCombo === 'true' || body.isFullCombo === true;
  if (body.isAllPerfect !== undefined) input.isAllPerfect = body.isAllPerfect === 'true' || body.isAllPerfect === true;
  return input;
}

function finalizePhoto(recordId, file) {
  if (!file) return null;
  const ext = path.extname(file.filename) || '.png';
  const finalName = `${recordId}${ext}`;
  const finalPath = path.join(scoreStore.PHOTO_DIR, finalName);
  try {
    fs.renameSync(file.path, finalPath);
  } catch (e) {
    return null;
  }
  return finalName;
}

// --- API ---

app.get('/api/records', (req, res) => {
  res.json(scoreStore.listRecords());
});

app.get('/api/records/:id', (req, res) => {
  const record = scoreStore.getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: 'not found' });
  res.json(record);
});

app.post('/api/records', upload.single('photo'), (req, res) => {
  const input = parseBody(req.body);
  const result = scoreStore.createRecord(input);
  if (result.error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: result.error });
  }
  if (req.file) {
    const finalName = finalizePhoto(result.value.id, req.file);
    if (finalName) scoreStore.setPhoto(result.value.id, finalName);
  }
  res.status(201).json(scoreStore.getRecord(result.value.id));
});

app.put('/api/records/:id', upload.single('photo'), (req, res) => {
  const input = parseBody(req.body);
  const result = scoreStore.updateRecord(req.params.id, input);
  if (result.error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(result.error === 'not found' ? 404 : 400).json({ error: result.error });
  }
  if (req.file) {
    const finalName = finalizePhoto(req.params.id, req.file);
    if (finalName) scoreStore.setPhoto(req.params.id, finalName);
  } else if (req.body.removePhoto === 'true') {
    scoreStore.setPhoto(req.params.id, null);
  }
  res.json(scoreStore.getRecord(req.params.id));
});

app.delete('/api/records/:id', (req, res) => {
  const result = scoreStore.deleteRecord(req.params.id);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`プロセカ スコア管理アプリ 起動中: http://localhost:${PORT}`));
} else {
  module.exports = app;
}
